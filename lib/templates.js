const cds = require("@sap/cds");
const defaults = require("./defaults");
const _ = require("lodash");
const {
    AUTHENTICATION_TYPE,
    DATA_PRODUCT_ANNOTATION,
    DATA_PRODUCT_TYPE,
    DESCRIPTION_PREFIX,
    ENTITY_RELATIONSHIP_ANNOTATION,
    LEVEL,
    ORD_EXTENSIONS_PREFIX,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    ORD_RESOURCE_TYPE,
    RESOURCE_VISIBILITY,
    SEM_VERSION_REGEX,
    SHORT_DESCRIPTION_PREFIX,
    CONTENT_MERGE_KEY,
    CDS_ELEMENT_KIND,
} = require("./constants");
const { Logger } = require("./logger");

function unflatten(flattedObject) {
    let result = {};
    _.keys(flattedObject).forEach(function (key) {
        _.set(result, key, flattedObject[key]);
    });
    return result;
}

function readORDExtensions(model) {
    const ordExtensions = {};
    for (const key in model) {
        if (key.startsWith(ORD_EXTENSIONS_PREFIX)) {
            const ordKey = key.replace(ORD_EXTENSIONS_PREFIX, "");
            ordExtensions[ordKey] = model[key];
        }
    }
    return unflatten(ordExtensions);
}

const _generatePaths = (srv, srvDefinition) => {
    const srvObj = { name: srv, definition: srvDefinition };
    const protocols = cds.service.protocols;

    const paths = protocols.endpoints4(srvObj);

    //TODO: check graphql replication in paths object and re-visit logic
    //removing instances of graphql protocol from paths
    for (var index = paths.length - 1; index >= 0; index--) {
        if (paths[index].kind === "graphql") {
            Logger.warn("Graphql protocol is not supported.");
            paths.splice(index, 1);
        }
    }

    //putting OData as default in case of non-supported protocol
    if (paths.length === 0) {
        srvDefinition["@odata"] = true;
        paths.push({ kind: "odata", path: protocols.path4(srvDefinition) });
    }

    return paths;
};

const createEntityTypeMappingsItemTemplate = (entity) => {
    if (entity[ORD_ODM_ENTITY_NAME_ANNOTATION]) {
        return {
            ordId: `sap.odm:entityType:${entity[ORD_ODM_ENTITY_NAME_ANNOTATION]}:v1`,
            entityName: entity[ORD_ODM_ENTITY_NAME_ANNOTATION],
            ...entity,
        };
    } else if (entity[ENTITY_RELATIONSHIP_ANNOTATION]) {
        const ordIdParts = entity[ENTITY_RELATIONSHIP_ANNOTATION].split(":");
        const namespace = ordIdParts[0];
        const entityName = ordIdParts[1];
        const version = ordIdParts[2] || "v1";
        return {
            ordId: `${namespace}:entityType:${entityName}:${version}`,
            entityName,
            ...entity,
        };
    }
};

function _getGroupID(fullyQualifiedName, groupTypeId = defaults.groupTypeId, appConfig) {
    return `${groupTypeId}:${appConfig.ordNamespace}:${fullyQualifiedName}`;
}

function _getTitleFromServiceName(srv) {
    let serviceName = srv.substring(srv.lastIndexOf(".") + 1);
    let index = serviceName.indexOf("Service");
    if (index >= 0) {
        return `${serviceName.substring(0, index)} Service`;
    } else {
        return `${serviceName} Service`;
    }
}

function _getEntityVersion(entity) {
    const entityVersion = entity.ordId.split(":").pop();
    const version = entityVersion.replace("v", "") + ".0.0"; // TODO: version can be stated/overwritten by annotation
    if (!SEM_VERSION_REGEX.test(version)) {
        Logger.warn(`Entity version "${version}" is not a valid semantic version.`);
    }
    return version;
}

function _getResourceDefinition(
    resourceType,
    mediaType,
    ordId,
    serviceName,
    fileExtension,
    accessStrategies = [{ type: AUTHENTICATION_TYPE.Open }],
) {
    return {
        type: resourceType,
        mediaType: `application/${mediaType}`,
        url: `/ord/v1/${ordId}/${serviceName}.${fileExtension}`,
        accessStrategies,
    };
}

const createGroupsTemplateForService = (serviceName, serviceDefinition, appConfig) => {
    const ordExtensions = readORDExtensions(serviceDefinition);

    if (!serviceDefinition) {
        Logger.warn("Unable to find service definition:", serviceName);
        return undefined;
    }

    const groupId = _getGroupID(serviceName, defaults.groupTypeId, appConfig);
    return {
        groupId: groupId,
        groupTypeId: defaults.groupTypeId,
        title: ordExtensions.title ?? _getTitleFromServiceName(serviceName),
    };
};

const createEntityTypeTemplate = (appConfig, packageIds, entity) => {
    const ordExtensions = readORDExtensions(entity);
    const visibility = ordExtensions.visibility || RESOURCE_VISIBILITY.public;

    if (visibility === RESOURCE_VISIBILITY.private) {
        return null;
    }

    const packageId = _getPackageID(appConfig.ordNamespace, packageIds, ORD_RESOURCE_TYPE.entityType, visibility);

    return {
        ordId: entity.ordId,
        localId: entity.entityName,
        title: entity["@title"] ?? entity["@Common.Label"] ?? entity.entityName,
        shortDescription: SHORT_DESCRIPTION_PREFIX + entity.entityName,
        description: DESCRIPTION_PREFIX + entity.entityName,
        version: _getEntityVersion(entity),
        lastUpdate: appConfig.lastUpdate,
        visibility,
        partOfPackage: packageId,
        releaseStatus: "active",
        level: entity["@ObjectModel.compositionRoot"] || entity["@ODM.root"] ? LEVEL.rootEntity : LEVEL.subEntity,
        extensible: { supported: "no" },
        ...ordExtensions,
    };
};

function _handleVisibility(ordExtensions, definition) {
    let visibility;
    if (ordExtensions.visibility) {
        visibility = ordExtensions.visibility;
    } else if (definition[ORD_EXTENSIONS_PREFIX + "visibility"]) {
        visibility = definition[ORD_EXTENSIONS_PREFIX + "visibility"];
    } else {
        visibility = RESOURCE_VISIBILITY.public;
    }
    return visibility;
}

const createAPIResourceTemplate = (serviceName, serviceDefinition, appConfig, packageIds, accessStrategies) => {
    const ordExtensions = readORDExtensions(serviceDefinition);
    const visibility = _handleVisibility(ordExtensions, serviceDefinition);
    const packageId = _getPackageID(appConfig.ordNamespace, packageIds, ORD_RESOURCE_TYPE.api, visibility);

    const paths = _generatePaths(serviceName, serviceDefinition);
    const apiResources = [];
    const ordId = `${appConfig.ordNamespace}:apiResource:${serviceName}:v1`;

    paths.forEach((generatedPath) => {
        let resourceDefinitions = [
            _getResourceDefinition("openapi-v3", "json", ordId, serviceName, "oas3.json", accessStrategies),
        ];

        if (generatedPath.kind !== "rest") {
            //edmx resource definition is not generated in case of 'rest' protocol
            resourceDefinitions.push(
                _getResourceDefinition("edmx", "xml", ordId, serviceName, "edmx", accessStrategies),
            );
        }

        const entityTypeMappings = _getEntityTypeMappings(serviceDefinition);

        let obj = {
            ordId,
            title: serviceDefinition["@title"] ?? serviceDefinition["@Common.Label"] ?? serviceName,
            shortDescription: SHORT_DESCRIPTION_PREFIX + serviceName,
            description: serviceDefinition["@Core.Description"] ?? DESCRIPTION_PREFIX + serviceName,
            version: "1.0.0",
            lastUpdate: appConfig.lastUpdate,
            visibility,
            partOfPackage: packageId,
            partOfGroups: [_getGroupID(serviceName, defaults.groupTypeId, appConfig)],
            releaseStatus: "active",
            apiProtocol: generatedPath.kind === "odata" ? "odata-v4" : generatedPath.kind,
            resourceDefinitions: resourceDefinitions,
            entryPoints: [generatedPath.path],
            extensible: {
                supported: "no",
            },
            ...(entityTypeMappings ? { entityTypeMappings } : {}),
            ...ordExtensions,
        };

        if (serviceDefinition[DATA_PRODUCT_ANNOTATION] === DATA_PRODUCT_TYPE.primary) {
            obj.apiProtocol = "rest";
            obj.visibility = RESOURCE_VISIBILITY.internal;
            obj.direction = "outbound";
            obj.implementationStandard = "sap.dp:data-subscription-api:v1";
            obj.entryPoints = [];
            obj.resourceDefinitions = [
                _getResourceDefinition(
                    "sap-csn-interop-effective-v1",
                    "json",
                    ordId,
                    serviceName,
                    "csn.json",
                    accessStrategies,
                ),
            ];

            apiResources.push(obj);
        }

        if (obj.visibility !== RESOURCE_VISIBILITY.private) {
            apiResources.push(obj);
        }
    });

    return apiResources;
};

const createEventResourceTemplate = (serviceName, serviceDefinition, appConfig, packageIds, accessStrategies) => {
    const ordExtensions = readORDExtensions(serviceDefinition);
    const visibility = _handleVisibility(ordExtensions, serviceDefinition);
    const packageId = _getPackageID(appConfig.ordNamespace, packageIds, ORD_RESOURCE_TYPE.event, visibility);
    const ordId = `${appConfig.ordNamespace}:eventResource:${serviceName}:v1`;
    const entityTypeMappings = _getEntityTypeMappings(serviceDefinition);

    let obj = {
        ordId,
        title:
            serviceDefinition["@title"] ??
            serviceDefinition["@Common.Label"] ??
            `ODM ${appConfig.appName.replace(/[^a-zA-Z0-9]/g, "")} Events`,
        shortDescription: `${serviceName} event resource`,
        description:
            serviceDefinition["@description"] ??
            serviceDefinition["@Core.Description"] ??
            "CAP Event resource describing events / messages.",
        version: "1.0.0",
        lastUpdate: appConfig.lastUpdate,
        releaseStatus: "active",
        partOfPackage: packageId,
        partOfGroups: [_getGroupID(serviceName, defaults.groupTypeId, appConfig)],
        visibility,
        resourceDefinitions: [
            _getResourceDefinition("asyncapi-v2", "json", ordId, serviceName, "asyncapi2.json", accessStrategies),
        ],
        extensible: { supported: "no" },
        ...(entityTypeMappings ? { entityTypeMappings } : {}),
        ...ordExtensions,
    };

    return obj.visibility === RESOURCE_VISIBILITY.public || obj.visibility === RESOURCE_VISIBILITY.internal
        ? [obj]
        : [];
};

function _getEntityTypeMappings(definitionObj) {
    if (!definitionObj.entities) {
        return;
    }
    const entities = Object.values(definitionObj.entities)
        .flatMap((entity) => _flattenEntityGraph(entity))
        .map(createEntityTypeMappingsItemTemplate);
    const entityTypeTargets = _.uniqBy(entities, CONTENT_MERGE_KEY)
        .filter((entity) => entity !== undefined)
        .map(({ ordId }) => ({
            ordId,
        }));
    if (entityTypeTargets.length > 0) {
        return [{ entityTypeTargets }];
    } else {
        return;
    }
}

function _flattenEntityGraph(currentEntity, processedEntities = []) {
    if (!currentEntity.associations) {
        return [currentEntity];
    }
    const entityAssociationTargets = Object.values(currentEntity.associations).map((association) => ({
        target: association.target,
        entity: association._target,
    }));

    const assertionsTodo = [];
    entityAssociationTargets.forEach(({ target, entity }) => {
        if (processedEntities.includes(target)) {
            return;
        }
        processedEntities = [...processedEntities, target];
        assertionsTodo.push(entity);
    });

    return [currentEntity, ...assertionsTodo.flatMap((entity) => _flattenEntityGraph(entity, processedEntities))];
}

function _getPackageID(namespace, packageIds, resourceType, visibility = RESOURCE_VISIBILITY.public) {
    if (!packageIds) return;

    if (resourceType) {
        return (
            packageIds.find((id) => {
                if (visibility === RESOURCE_VISIBILITY.public) {
                    return id.includes(resourceType) && !id.includes("-internal") && !id.includes("-private");
                } else {
                    return id.includes(`${resourceType}-${visibility}`);
                }
            }) || packageIds.find((id) => id.includes(namespace))
        );
    }

    return packageIds.find((id) => id.includes(`-${resourceType}-`)) || packageIds.find((id) => id.includes(namespace));
}

function _propagateORDVisibility(model) {
    for (const [name, def] of Object.entries(model.definitions)) {
        if (def.kind === CDS_ELEMENT_KIND.service && def[ORD_EXTENSIONS_PREFIX + "visibility"]) {
            const serviceName = name;
            const serviceVisibility = def[ORD_EXTENSIONS_PREFIX + "visibility"];
            for (const serviceChildrenDef of model.definitions) {
                if (serviceChildrenDef.name.startsWith(serviceName + ".")) {
                    if (!serviceChildrenDef[ORD_EXTENSIONS_PREFIX + "visibility"]) {
                        serviceChildrenDef[ORD_EXTENSIONS_PREFIX + "visibility"] = serviceVisibility;
                    }
                }
            }
        }
    }

    return model;
}

module.exports = {
    createEntityTypeTemplate,
    createEntityTypeMappingsItemTemplate,
    createGroupsTemplateForService,
    createAPIResourceTemplate,
    createEventResourceTemplate,
    _getPackageID,
    _getEntityTypeMappings,
    _propagateORDVisibility,
};
