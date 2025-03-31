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
    SHORT_DESCRIPTION_PREFIX
} = require("./constants");
const { Logger } = require("./logger");

function unflatten(flattedObject) {
    let result = {}
    _.keys(flattedObject).forEach(function (key) {
        _.set(result, key, flattedObject[key])
    })
    return result
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

/**
 * Reads the service definition and returns an array of entryPoint paths.
 *
 * @param {string} srv The service definition name.
 * @param {Object} srvDefinition The service definition object.
 * @returns {Array} An array containing paths and it's kind.
 */

const _generatePaths = (srv, srvDefinition) => {
    const srvObj = { name: srv, definition: srvDefinition };
    const protocols = cds.service.protocols;

    const paths = protocols.endpoints4(srvObj);

    //TODO: check graphql replication in paths object and re-visit logic
    //removing instances of graphql protocol from paths
    for (var index = paths.length - 1; index >= 0; index--) {
        if (paths[index].kind === "graphql") {
            Logger.warn('Graphql protocol is not supported.');
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

/**
 * This is a template function to create item of entityTypeMappings array.
 *
 * @param {string} entity The entity definition.
 * @returns {Object} An entry of the entityTypeMappings array.
 */
const createEntityTypeMappingsItemTemplate = (entity) => {
    if (entity[ORD_ODM_ENTITY_NAME_ANNOTATION]) {
        return {
            ordId: `sap.odm:entityType:${entity[ORD_ODM_ENTITY_NAME_ANNOTATION]}:v1`,
            entityName: entity[ORD_ODM_ENTITY_NAME_ANNOTATION],
            ...entity
        }
    } else if (entity[ENTITY_RELATIONSHIP_ANNOTATION]) {
        const ordIdParts = entity[ENTITY_RELATIONSHIP_ANNOTATION].split(":");
        const namespace = ordIdParts[0];
        const entityName = ordIdParts[1];
        const version = ordIdParts[2] || "v1";
        return {
            ordId: `${namespace}:entityType:${entityName}:${version}`,
            entityName,
            ...entity
        };
    }
};

function _getGroupID(
    fullyQualifiedName,
    groupTypeId = defaults.groupTypeId,
    appConfig,
) {
    return `${groupTypeId}:${appConfig.ordNamespace}:${fullyQualifiedName}`;
}

/**
 * This is a function to resolve the title of the service group.
 *
 * @param {string} srv The name of the service.
 * @returns {string} The title of the service group.
 */
function _getTitleFromServiceName(srv) {
    let serviceName = srv.substring(srv.lastIndexOf(".") + 1);
    let index = serviceName.indexOf("Service");
    if (index >= 0) {
        return `${serviceName.substring(0, index)} Service`;
    } else {
        return `${serviceName} Service`;
    }
}


/**
 * This is a function to get the version of the entity,
 * validate it and log if it is not a valid semantical version.
 *
 * @param {object} entity An entity object.
 * @returns Version of the entity with '1.0.0' as fallback value.
 */
function _getEntityVersion(entity) {
    const entityVersion = entity.ordId.split(":").pop();
    const version = entityVersion.replace("v", "") + ".0.0"; // TODO: version can be stated/overwritten by annotation
    if (!SEM_VERSION_REGEX.test(version)) {
        Logger.warn(`Entity version "${version}" is not a valid semantic version.`);
    }
    return version;
}

/**
 * This is a function to create a resource definition object.
 * @param {string} resourceType The type of the resource.
 * @param {string} mediaType The media type of the resource.
 * @param {string} ordId The ordId of the resource.
 * @param {string} serviceName The name of the service.
 * @param {string} fileExtension The file extension of the resource.
 * @param {Array} accessStrategies The array of accessStrategies objects
 * @returns {Object} A resource definition object.
 * @private
 */
function _getResourceDefinition(
    resourceType,
    mediaType,
    ordId,
    serviceName,
    fileExtension, accessStrategies = [{ type: AUTHENTICATION_TYPE.Open }]) {
    return {
        type: resourceType,
        mediaType: `application/${mediaType}`,
        url: `/ord/v1/${ordId}/${serviceName}.${fileExtension}`,
        accessStrategies
    }
}

/**
 * This is a template function to create group object of a service for groups array in ORD doc.
 *
 * @param {string} serviceName The name of the service.
 * @param {object} serviceDefinition The definition of the service
 * @param {Set} groupIds A set of group ids.
 * @returns {Object} A group object.
 */
const createGroupsTemplateForService = (serviceName, serviceDefinition, appConfig) => {
    const ordExtensions = readORDExtensions(serviceDefinition);

    if (!serviceDefinition) {
        Logger.warn('Unable to find service definition:', serviceName)
        return undefined
    }

    const groupId = _getGroupID(serviceName, defaults.groupTypeId, appConfig);
    return {
        groupId: groupId,
        groupTypeId: defaults.groupTypeId,
        title: ordExtensions.title ?? _getTitleFromServiceName(serviceName)
    };
}

/**
 * This is a template function to create EntityType object for EntityTypes Array.
 * Ensures correct visibility assignment based on referenced resources.
 *
 * @param { object } appConfig  The configuration object.
 * @param { Array } packageIds The available package identifiers.
 * @param { object } entity The entity definition.
 * @returns { object } An object for the EntityType.
 */
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


/**
 * This is a template function to create API Resource object for API Resource Array.
 * Properties of an API resource can be overwritten by the ORD extensions. Example: visibility.
 * Ensures proper visibility compliance by checking associated EntityTypes.

 * @param {string} serviceName The name of the service.
 * @param {object} serviceDefinition The definition of the service
 * @param {object} appConfig - The application configuration.
 * @param {Array} packageIds - The available package identifiers.
 * @returns {Array} An array of objects for the API Resources.
 */
const createAPIResourceTemplate = (serviceName, serviceDefinition, appConfig, packageIds, accessStrategies) => {
    const ordExtensions = readORDExtensions(serviceDefinition);
    const visibility = ordExtensions.visibility || RESOURCE_VISIBILITY.public;
    const packageId = _getPackageID(appConfig.ordNamespace, packageIds, ORD_RESOURCE_TYPE.api, visibility);

    const paths = _generatePaths(serviceName, serviceDefinition);
    const apiResources = [];
    const ordId = `${appConfig.ordNamespace}:apiResource:${serviceName}:v1`;

    paths.forEach((generatedPath) => {
        let resourceDefinitions = [_getResourceDefinition("openapi-v3", "json", ordId, serviceName, "oas3.json", accessStrategies)];

        if (generatedPath.kind !== "rest") {
            //edmx resource definition is not generated in case of 'rest' protocol
            resourceDefinitions.push(_getResourceDefinition("edmx", "xml", ordId, serviceName, "edmx", accessStrategies));
        }

        let obj = {
            ordId,
            title:
                serviceDefinition["@title"] ??
                serviceDefinition["@Common.Label"] ??
                serviceName,
            shortDescription: SHORT_DESCRIPTION_PREFIX + serviceName,
            description:
                serviceDefinition["@Core.Description"] ??
                DESCRIPTION_PREFIX + serviceName,
            version: "1.0.0",
            lastUpdate: appConfig.lastUpdate,
            visibility,
            partOfPackage: packageId,
            partOfGroups: [_getGroupID(serviceName, defaults.groupTypeId, appConfig)],
            releaseStatus: "active",
            apiProtocol:
                generatedPath.kind === "odata" ? "odata-v4" : generatedPath.kind,
            resourceDefinitions: resourceDefinitions,
            entryPoints: [generatedPath.path],
            extensible: {
                supported: "no",
            },
            entityTypeMappings: (appConfig.entityTypeTargets?.length > 0)
                ? [{
                    entityTypeTargets: appConfig.entityTypeTargets.map(m => ({ ordId: m.ordId }))
                }]
                : (Array.isArray(appConfig.entityTypeMappings)
                    ? [{
                        entityTypeTargets: _.uniqBy(
                            appConfig.entityTypeMappings.flatMap(m => m.entityTypeTargets).map(et => ({ ordId: et.ordId })),
                            'ordId'
                        )
                    }]
                    : []),
            ...ordExtensions,
        };

        if (serviceDefinition[DATA_PRODUCT_ANNOTATION] === DATA_PRODUCT_TYPE.primary) {
            obj.apiProtocol = "rest";
            obj.visibility = RESOURCE_VISIBILITY.internal;
            obj.direction = "outbound";
            obj.implementationStandard = "sap.dp:data-subscription-api:v1";
            obj.entryPoints = [];
            obj.resourceDefinitions = [_getResourceDefinition("sap-csn-interop-effective-v1", "json", ordId, serviceName, "csn.json", accessStrategies)];

            apiResources.push(obj);
        }


        if (obj.visibility === RESOURCE_VISIBILITY.public || obj.visibility === RESOURCE_VISIBILITY.internal) {
            apiResources.push(obj);
        }

    });

    return apiResources;
};

/**
 * This is a template function to create Event Resource object for Event Resource Array.
 * There can be only one event resource per service because all events are using the same protocol, they are always Cloud Events.
 * Properties of an event resource can be overwritten by the ORD extensions. Example: visibility.
 * Ensures proper visibility compliance by checking associated EntityTypes.
 *
 * @param {string} serviceName The name of the service.
 * @param {object} serviceDefinition The definition of the service
 * @returns {Array} An single-item array of objects for the Event Resources.
 */
const createEventResourceTemplate = (serviceName, serviceDefinition, appConfig, packageIds, accessStrategies) => {
    const ordExtensions = readORDExtensions(serviceDefinition);
    const visibility = ordExtensions.visibility || RESOURCE_VISIBILITY.public;

    const packageId = _getPackageID(appConfig.ordNamespace, packageIds, ORD_RESOURCE_TYPE.event, visibility);

    const ordId = `${appConfig.ordNamespace}:eventResource:${serviceName}:v1`;
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
        resourceDefinitions: [_getResourceDefinition("asyncapi-v2", "json", ordId, serviceName, "asyncapi2.json", accessStrategies)],
        extensible: { supported: "no" },
        entityTypeMappings: (appConfig.entityTypeTargets?.length > 0)
                ? [{
                    entityTypeTargets: appConfig.entityTypeTargets.map(m => ({ ordId: m.ordId }))
                }]
                : (Array.isArray(appConfig.entityTypeMappings)
                    ? [{
                        entityTypeTargets: _.uniqBy(
                            appConfig.entityTypeMappings.flatMap(m => m.entityTypeTargets).map(et => ({ ordId: et.ordId })),
                            'ordId'
                        )
                    }]
                    : []),
        ...ordExtensions
    };

    return obj.visibility === RESOURCE_VISIBILITY.public || obj.visibility === RESOURCE_VISIBILITY.internal ? [obj] : [];
};

function _getPackageID(namespace, packageIds, resourceType, visibility = RESOURCE_VISIBILITY.public) {
    if (!packageIds) return;

    if (resourceType) {
        return packageIds.find(id => {
            if (visibility === RESOURCE_VISIBILITY.public) {
                return id.includes(resourceType) &&
                       !id.includes("-internal") &&
                       !id.includes("-private");
            } else {
                return id.includes(`${resourceType}-${visibility}`);
            }
        }) || packageIds.find((id) => id.includes(namespace));
    }

    return packageIds.find((id) => id.includes(`-${resourceType}-`)) ||
           packageIds.find((id) => id.includes(namespace));
}

module.exports = {
    createEntityTypeTemplate,
    createEntityTypeMappingsItemTemplate,
    createGroupsTemplateForService,
    createAPIResourceTemplate,
    createEventResourceTemplate,
    _getPackageID
};
