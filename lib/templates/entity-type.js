const _ = require("lodash");

const Logger = require("../logger");
const { createPackages } = require("./package");
const { readORDExtensions, isExposedEntityType } = require("../common/utils");
const {
    LEVEL,
    SEM_VERSION_REGEX,
    RESOURCE_VISIBILITY,
    ENTITY_RELATIONSHIP_ANNOTATION,
    CONTENT_MERGE_KEY,
} = require("../constants");

const RESOLVERS = Object.freeze({
    ordId: (entity, appConfig) => {
        const [namespace, name, version = "v1"] = entity[ENTITY_RELATIONSHIP_ANNOTATION].split(":");

        return (
            entity["@ORD.Extensions.ordId"]?.replace(/\{namespace}/g, appConfig.ordNamespace) ??
            `${namespace}:entityType:${name}:v${(entity["@ORD.Extensions.version"] ?? version.substring(1)).split(".")[0]}`
        );
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
    version: (entity, appConfig) => {
        const ordId = RESOLVERS.ordId(entity, appConfig);
        const version = entity["@ORD.Extensions.version"] ?? ordId.split(":").pop().replace("v", "") + ".0.0";

        if (!SEM_VERSION_REGEX.test(version)) {
            Logger.warn("Entity version", version, "is not a valid semantic version.");
        }

        return version;
    },
    visibility: (entity, appConfig) => {
        return entity["@ORD.Extensions.visibility"] ?? appConfig.env?.defaultVisibility ?? RESOURCE_VISIBILITY.public;
    },
    partOfPackage: (entity, appConfig) => {
        const visibility = RESOLVERS.visibility(entity, appConfig);
        const name = appConfig.appName?.replace(/[^a-zA-Z0-9]/g, "");
        const packages = createPackages(appConfig).map((pkg) => pkg.ordId);
        const suffix = visibility === RESOURCE_VISIBILITY.public ? "" : `-${visibility}`;

        return (
            entity["@ORD.Extensions.partOfPackage"]?.replace(/\{namespace}/g, appConfig.ordNamespace) ??
            [
                `${appConfig.ordNamespace}:package:${name}-entityType${suffix}:v1`,
                `${appConfig.ordNamespace}:package:${name}:v1`,
            ].find((candidate) => packages.includes(candidate))
        );
    },
});

/**
 * This is a template function to create EntityType object for EntityTypes Array.
 * Ensures correct visibility assignment based on referenced resources.
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
        description: `Description for ${RESOLVERS.localId(entity)}`,
        shortDescription: `Short description of ${RESOLVERS.localId(entity)}`,

        ...readORDExtensions(entity),

        title: RESOLVERS.title(entity),
        level: RESOLVERS.level(entity),
        localId: RESOLVERS.localId(entity),
        ordId: RESOLVERS.ordId(entity, appConfig),
        version: RESOLVERS.version(entity, appConfig),
        visibility: RESOLVERS.visibility(entity, appConfig),
        partOfPackage: RESOLVERS.partOfPackage(entity, appConfig),
    };
}

function createEntityTypes(appConfig) {
    return appConfig.hasSAPPolicyLevel
        ? [] // If SAP policy level is present, don't create entity type, they must be in the central repository
        : _.uniqBy(
              Object.values(appConfig.csn.definitions)
                  .filter((definition) => isExposedEntityType(definition))
                  .map((entity) => createEntityTypeTemplate(appConfig, entity))
                  .filter((entity) => entity.visibility !== RESOURCE_VISIBILITY.private),
              CONTENT_MERGE_KEY,
          );
}

module.exports = {
    createEntityTypes,
    createEntityTypeTemplate,
    RESOLVERS,
};
