const _ = require("lodash");

const Logger = require("../logger");
const { createPackages } = require("./package");
const placeholders = require("../common/placeholders");
const { readORDExtensions, isExposedEntityType } = require("../common/utils");
const {
    resolveEntityTypeOrdId,
    resolveODMEntityTypeOrdId,
    resolveEntityTypeLevel,
    resolveRootEntityOrdId,
    isAggregateGenerationEnabled,
} = require("../common/entity-types");
const {
    LEVEL,
    SEM_VERSION_REGEX,
    RESOURCE_VISIBILITY,
    ENTITY_RELATIONSHIP_ANNOTATION,
} = require("../constants");

const RESOLVERS = Object.freeze({
    ordId: resolveEntityTypeOrdId,
    title: (entity) => {
        return (
            entity["@ORD.Extensions.title"] ??
            entity["@title"] ??
            entity["@Common.Label"] ??
            entity["@EndUserText.label"] ??
            RESOLVERS.localId(entity)
        );
    },
    description: (entity) => {
        return (
            entity["@ORD.Extensions.description"] ??
            entity["@Core.Description"] ??
            entity["@description"] ??
            `Description for ${RESOLVERS.localId(entity)}`
        );
    },
    shortDescription: (entity) => {
        return (
            entity["@ORD.Extensions.shortDescription"] ??
            entity["@Core.ShortDescription"] ??
            `Short description of ${RESOLVERS.localId(entity)}`
        );
    },
    level: resolveEntityTypeLevel,
    localId: (entity) => {
        const [, name] = entity[ENTITY_RELATIONSHIP_ANNOTATION].split(":");
        return entity["@ORD.Extensions.localId"] ?? name;
    },
    version: (entity, appConfig) => {
        const ordId = RESOLVERS.ordId(entity, appConfig);
        const version = entity["@ORD.Extensions.version"] ?? ordId.split(":").pop().replace("v", "") + ".0.0";

        if (!SEM_VERSION_REGEX.test(version)) {
            Logger.warn("Entity version", version, "is not a valid semantic version.");
        }

        return version;
    },
    visibility: (entity, appConfig) => {
        return entity["@ORD.Extensions.visibility"] ?? appConfig.env?.defaultVisibility ?? RESOURCE_VISIBILITY.internal;
    },
    partOfPackage: (entity, appConfig) => {
        const namespace = appConfig.ordNamespace;
        const visibility = RESOLVERS.visibility(entity, appConfig);
        const name = appConfig.appName?.replace(/[^a-zA-Z0-9]/g, "");
        const packages = createPackages(appConfig).map((pkg) => pkg.ordId);
        const suffix = visibility === RESOURCE_VISIBILITY.public ? "" : `-${visibility}`;

        return (
            placeholders.replace(entity["@ORD.Extensions.partOfPackage"], {
                type: "package",
                namespace: namespace,
            }) ??
            [`${namespace}:package:${name}-entityType${suffix}:v1`, `${namespace}:package:${name}:v1`].find(
                (candidate) => packages.includes(candidate),
            )
        );
    },
});

/**
 * This is a template function to create EntityType object for EntityTypes Array.
 *
 * @param { object } appConfig  The configuration object.
 * @param { object } entity The entity definition.
 * @returns { object } An object for the EntityType (see: https://pages.github.tools.sap/CentralEngineering/open-resource-discovery-specification/spec-v1/interfaces/Document#entity-type).
 */
function createEntityTypeTemplate(appConfig, entity) {
    return {
        releaseStatus: "active",
        extensible: { supported: "no" },
        lastUpdate: appConfig.lastUpdate,
        description: RESOLVERS.description(entity),
        shortDescription: RESOLVERS.shortDescription(entity),

        title: RESOLVERS.title(entity),
        level: RESOLVERS.level(entity, appConfig),
        localId: RESOLVERS.localId(entity),
        ordId: RESOLVERS.ordId(entity, appConfig),
        version: RESOLVERS.version(entity, appConfig),
        visibility: RESOLVERS.visibility(entity, appConfig),
        partOfPackage: RESOLVERS.partOfPackage(entity, appConfig),

        ..._.omit(readORDExtensions(entity), Object.keys(RESOLVERS)),
    };
}

function createEntityTypes(appConfig) {
    const entities = Object.values(appConfig.csn.definitions).filter((definition) => isExposedEntityType(definition));
    const resources = new Map();
    const generatedRoots = new Set();
    const aggregateGeneration = isAggregateGenerationEnabled(appConfig);

    for (const entity of entities) {
        const resource = createEntityTypeTemplate(appConfig, entity);
        if (resource.visibility === RESOURCE_VISIBILITY.private) continue;
        const existing = resources.get(resource.ordId);
        if (aggregateGeneration && existing && existing.level !== resource.level) {
            throw new Error(`Conflicting entity type levels for ${resource.ordId}`);
        }
        if (!existing) resources.set(resource.ordId, resource);
    }

    if (!aggregateGeneration) return [...resources.values()];

    for (const entity of entities) {
        const resource = resources.get(RESOLVERS.ordId(entity, appConfig));
        if (!resource || RESOLVERS.visibility(entity, appConfig) === RESOURCE_VISIBILITY.private) continue;
        const odmId = resolveODMEntityTypeOrdId(entity);
        if (odmId && odmId !== resource.ordId) {
            addRelationship(resource, odmId, "can-share-identity");
        }
        if (resource.level !== LEVEL.aggregate) continue;

        const rootId = resolveRootEntityOrdId(entity, appConfig);
        if (rootId) {
            const existing = resources.get(rootId);
            if (existing && !generatedRoots.has(rootId)) {
                throw new Error(`Generated root entity type ID collides with ${rootId}`);
            }
            if (!existing) {
                const root = { ...resource, ordId: rootId, localId: `${resource.localId}Root`, level: LEVEL.rootEntity };
                delete root.relatedEntityTypes;
                addRelationship(root, resource.ordId, "part-of");
                if (odmId && odmId !== rootId) addRelationship(root, odmId, "can-share-identity");
                resources.set(rootId, root);
                generatedRoots.add(rootId);
            }
        }

        for (const child of compositionChildren(entity)) {
            if (!isExposedEntityType(child) || RESOLVERS.visibility(child, appConfig) === RESOURCE_VISIBILITY.private) {
                continue;
            }
            const childResource = resources.get(RESOLVERS.ordId(child, appConfig));
            if (childResource && childResource.ordId !== resource.ordId) {
                addRelationship(childResource, resource.ordId, "part-of");
            }
        }
    }
    return [...resources.values()];
}

function addRelationship(resource, ordId, relationType) {
    // Explicit relationship metadata remains authoritative.
    const relationships = resource.relatedEntityTypes ?? [];
    if (!relationships.some((relationship) => relationship.ordId === ordId)) {
        resource.relatedEntityTypes = [...relationships, { ordId, relationType }];
    }
}

function compositionChildren(entity, visited = new Set([entity])) {
    const children = [];
    for (const composition of Object.values(entity.compositions ?? {})) {
        const child = composition._target;
        if (!child || visited.has(child)) continue;
        visited.add(child);
        children.push(child);
        children.push(...compositionChildren(child, visited));
    }
    return children;
}

module.exports = {
    createEntityTypes,
    createEntityTypeTemplate,
    RESOLVERS,
};
