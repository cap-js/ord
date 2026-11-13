const placeholders = require("./placeholders");
const { flattenEntityGraph } = require("./utils");
const { ENTITY_RELATIONSHIP_ANNOTATION, ORD_ODM_ENTITY_NAME_ANNOTATION, LEVEL, RESOURCE_VISIBILITY } = require("../constants");

function resolveEntityTypeOrdId(entity, appConfig = {}) {
    const override = placeholders.replace(entity["@ORD.Extensions.ordId"], {
        type: "entityType",
        namespace: appConfig.ordNamespace,
    });
    if (override !== undefined && override !== null) return override;

    const annotation = entity[ENTITY_RELATIONSHIP_ANNOTATION];
    if (!annotation) return undefined;
    const [namespace, name, version = "v1"] = annotation.split(":");
    const major = (entity["@ORD.Extensions.version"] ?? version.substring(1)).split(".")[0];
    return `${namespace}:entityType:${name}:v${major}`;
}

function resolveODMEntityTypeOrdId(entity) {
    const name = entity[ORD_ODM_ENTITY_NAME_ANNOTATION];
    if (!name) return undefined;
    if (!name.includes(":")) return `sap.odm:entityType:${name}:v1`;
    const [namespace, entityName, version = "v1"] = name.split(":");
    return `${namespace}:entityType:${entityName}:${version}`;
}

function isAggregateGenerationEnabled(appConfig) {
    return appConfig?.env?.entityTypes?.generateAggregates !== false;
}

function resolveEntityTypeLevel(entity, appConfig = {}) {
    const explicit = entity["@ORD.Extensions.level"];
    if (explicit) return explicit;
    if (!entity["@ObjectModel.compositionRoot"] && !entity["@ODM.root"]) return LEVEL.subEntity;
    return isAggregateGenerationEnabled(appConfig) ? LEVEL.aggregate : LEVEL.rootEntity;
}

function resolveRootEntityOrdId(entity, appConfig) {
    if (!isAggregateGenerationEnabled(appConfig) || !appConfig?.env?.entityTypes?.includeRootEntities) {
        return undefined;
    }
    if (resolveEntityTypeLevel(entity, appConfig) !== LEVEL.aggregate) return undefined;
    if (!entity["@ObjectModel.compositionRoot"] && !entity["@ODM.root"]) return undefined;
    const ordId = resolveEntityTypeOrdId(entity, appConfig);
    return ordId?.replace(/:([^:]+):([^:]+)$/, ":$1Root:$2");
}

function resolveExposedEntityTypes(service, appConfig) {
    const ordIds = new Set(
        Object.values(service.entities ?? {})
            .flatMap((entity) => flattenEntityGraph(entity))
            .filter((entity) => {
                if (!isAggregateGenerationEnabled(appConfig)) return true;
                const defaultVisibility = appConfig?.hasSAPPolicyLevel ? RESOURCE_VISIBILITY.internal : RESOURCE_VISIBILITY.public;
                const visibility = entity["@ORD.Extensions.visibility"] ?? appConfig?.env?.defaultVisibility ?? defaultVisibility;
                return visibility !== RESOURCE_VISIBILITY.private && !entity.name?.includes(".texts");
            })
            .flatMap((entity) => [
                resolveODMEntityTypeOrdId(entity),
                ...(entity[ENTITY_RELATIONSHIP_ANNOTATION]
                    ? [resolveEntityTypeOrdId(entity, appConfig), resolveRootEntityOrdId(entity, appConfig)]
                    : []),
            ])
            .filter(Boolean),
    );
    return [...ordIds].map((ordId) => ({ ordId }));
}

module.exports = {
    isAggregateGenerationEnabled,
    resolveEntityTypeOrdId,
    resolveODMEntityTypeOrdId,
    resolveEntityTypeLevel,
    resolveRootEntityOrdId,
    resolveExposedEntityTypes,
};
