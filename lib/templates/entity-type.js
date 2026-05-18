const Logger = require("../logger");
const { readORDExtensions } = require("../common/utils");
const { LEVEL, SEM_VERSION_REGEX, RESOURCE_VISIBILITY, ENTITY_RELATIONSHIP_ANNOTATION } = require("../constants");

const RESOLVERS = Object.freeze({
    ordId: (entity) => {
        const [namespace, name, version] = entity[ENTITY_RELATIONSHIP_ANNOTATION].split(":");

        return `${namespace}:entityType:${name}:v${(entity["@ORD.Extensions.version"] ?? version?.substring(1) ?? "1").split(".")[0]}`;
    },
    title: (entity) => {
        return (
            entity["@ORD.Extensions.title"] ??
            entity["@title"] ??
            entity["@Common.Label"] ??
            entity["@EndUserText.label"] ??
            RESOLVERS.localId(entity)
        );
    },
    level: (entity) => {
        return (
            entity["@ORD.Extensions.level"] ??
            (entity["@ObjectModel.compositionRoot"] || entity["@ODM.root"] ? LEVEL.rootEntity : LEVEL.subEntity)
        );
    },
    localId: (entity) => {
        return entity["@ORD.Extensions.localId"] ?? entity[ENTITY_RELATIONSHIP_ANNOTATION].split(":")[1];
    },
    version: (entity) => {
        const ordId = RESOLVERS.ordId(entity);
        const version = entity["@ORD.Extensions.version"] ?? ordId.split(":").pop().replace("v", "") + ".0.0";

        if (!SEM_VERSION_REGEX.test(version)) {
            Logger.warn("Entity version", version, "is not a valid semantic version.");
        }

        return version;
    },
    extensible: (entity) => {
        return {
            supported: entity["@ORD.Extensions.extensible.supported"] ?? "no",
            ...(entity["@ORD.Extensions.extensible.description"] && {
                description: entity["@ORD.Extensions.extensible.description"],
            }),
        };
    },
    description: (entity) => {
        return entity["@ORD.Extensions.description"] ?? `Description for ${RESOLVERS.localId(entity)}`;
    },
    releaseStatus: (entity) => {
        return entity["@ORD.Extensions.releaseStatus"] ?? "active";
    },
    shortDescription: (entity) => {
        return entity["@ORD.Extensions.shortDescription"] ?? `Short description of ${RESOLVERS.localId(entity)}`;
    },
    visibility: (entity, appConfig) => {
        return entity["@ORD.Extensions.visibility"] ?? appConfig.env?.defaultVisibility ?? RESOURCE_VISIBILITY.public;
    },
    lastUpdate: (entity, appConfig) => {
        return entity["@ORD.Extensions.lastUpdate"] ?? appConfig.lastUpdate;
    },
    partOfPackage: (entity, appConfig) => {
        const name = appConfig.appName?.replace(/[^a-zA-Z0-9]/g, "");

        return entity["@ORD.Extensions.partOfPackage"] ?? `${appConfig.ordNamespace}:package:${name}:v1`;
    },
});

/**
 * This is a template function to create EntityType object for EntityTypes Array.
 * Ensures correct visibility assignment based on referenced resources.
 *
 * @param { object } appConfig  The configuration object.
 * @param { object } entity The entity definition.
 * @returns { object } An object for the EntityType.
 */
const createEntityTypeTemplate = (appConfig, entity) => {
    return {
        ordId: RESOLVERS.ordId(entity),
        title: RESOLVERS.title(entity),
        level: RESOLVERS.level(entity),
        localId: RESOLVERS.localId(entity),
        version: RESOLVERS.version(entity),
        extensible: RESOLVERS.extensible(entity),
        description: RESOLVERS.description(entity),
        releaseStatus: RESOLVERS.releaseStatus(entity),
        lastUpdate: RESOLVERS.lastUpdate(entity, appConfig),
        visibility: RESOLVERS.visibility(entity, appConfig),
        shortDescription: RESOLVERS.shortDescription(entity),
        partOfPackage: RESOLVERS.partOfPackage(entity, appConfig),

        ...readORDExtensions(entity),
    };
};

module.exports = {
    createEntityTypeTemplate,
    RESOLVERS,
};
