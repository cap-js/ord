const {
    DESCRIPTION_PREFIX,
    ORD_EXTENSIONS_PREFIX,
    ORD_RESOURCE_TYPE,
    RESOURCE_VISIBILITY,
    SHORT_DESCRIPTION_PREFIX,
} = require("../constants");
const { findPackageId } = require("./naming");

function createEntityTypes(entities, config, packageIds) {
    if (!entities?.length) return [];
    if (hasSAPPolicyLevel(config.policyLevels)) return [];

    return entities.flatMap((entity) => {
        if (entity.isODMMapping) return [];

        const extensions = readEntityExtensions(entity);
        const visibility = extensions.visibility || RESOURCE_VISIBILITY.public;
        if (visibility === RESOURCE_VISIBILITY.private) return [];

        const packageId = findPackageId(config.ordNamespace, packageIds, ORD_RESOURCE_TYPE.entityType, visibility);
        const entityVersion = entity.ordId.split(":").pop();
        const version = entityVersion.replace("v", "") + ".0.0";

        return {
            ordId: entity.ordId,
            localId: entity.entityName,
            title: entity["@title"] ?? entity["@Common.Label"] ?? entity.entityName,
            shortDescription: SHORT_DESCRIPTION_PREFIX + entity.entityName,
            description: DESCRIPTION_PREFIX + entity.entityName,
            version,
            lastUpdate: config.lastUpdate,
            visibility,
            partOfPackage: packageId,
            releaseStatus: "active",
            level: entity["@ObjectModel.compositionRoot"] || entity["@ODM.root"] ? "root-entity" : "sub-entity",
            extensible: { supported: "no" },
            ...extensions,
        };
    });
}

function readEntityExtensions(entity) {
    const ordExtensions = {};
    for (const key in entity) {
        if (key.startsWith(ORD_EXTENSIONS_PREFIX)) {
            ordExtensions[key.replace(ORD_EXTENSIONS_PREFIX, "")] = entity[key];
        }
    }
    return ordExtensions;
}

function hasSAPPolicyLevel(policyLevels) {
    return policyLevels.some((policyLevel) => policyLevel.split(":")[0].toLowerCase() === "sap");
}

module.exports = { createEntityTypes, hasSAPPolicyLevel };
