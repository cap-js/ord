const cds = require("@sap/cds");
const defaults = require("./defaults");
const _ = require("lodash");
const {
    DESCRIPTION_PREFIX,
    ORD_EXTENSIONS_PREFIX,
    RESOURCE_VISIBILITY,
    SHORT_DESCRIPTION_PREFIX
} = require("./constants");

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
            console.warn("Graphql protocol is not supported.");
            paths.splice(index, 1);
        }
    }

    //putting default as odata in case no supported protcol is there
    if (paths.length === 0) {
        srvDefinition["@odata"] = true;
        paths.push({ kind: "odata", path: protocols.path4(srvDefinition) });
    }

    return paths;
};

/**
 * This is a template function to create Entity Type object for Entity Type Array.
 *
 * @param {string} entity The name of the entity.
 * @returns {Object} An object for the entity type.
 */
const createEntityTypeTemplate = (entity) => ({
    ordId: `sap.odm:entityType:${entity["@ODM.entityName"]}:v1`,
});

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
        console.warn("Unable to find service definition:", serviceName)
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
 * This is a template function to create API Resource object for API Resource Array.
 *
 * @param {string} serviceName The name of the service.
 * @param {object} serviceDefinition The definition of the service
 * @returns {Array} An array of objects for the API Resources.
 */
const createAPIResourceTemplate = (serviceName, serviceDefinition, appConfig, packageIds) => {
    const ordExtensions = readORDExtensions(serviceDefinition);
    const paths = _generatePaths(serviceName, serviceDefinition);
    const apiResources = [];

    paths.forEach((generatedPath) => {
        let resourceDefinitions = [
            {
                type: "openapi-v3",
                mediaType: "application/json",
                url: `/.well-known/open-resource-discovery/v1/api-metadata/${serviceName}.oas3.json`,
                accessStrategies: [{ type: "open" }],
            },
        ];

        if (generatedPath.kind !== "rest") {
            //edmx resource definition is not generated in case of 'rest' protocol
            resourceDefinitions.push({
                type: "edmx",
                mediaType: "application/xml",
                url: `/.well-known/open-resource-discovery/v1/api-metadata/${serviceName}.edmx`,
                accessStrategies: [{ type: "open" }],
            });
        }

        let obj = {
            ordId: `${appConfig.ordNamespace}:apiResource:${serviceName}:v1`,
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
            visibility: RESOURCE_VISIBILITY.public, // default visibility
            partOfPackage: _getPackageID(appConfig.ordNamespace, packageIds, "api"),
            partOfGroups: [_getGroupID(serviceName, defaults.groupTypeId, appConfig)],
            releaseStatus: "active",
            apiProtocol:
                generatedPath.kind === "odata" ? "odata-v4" : generatedPath.kind,
            resourceDefinitions: resourceDefinitions,
            entryPoints: [generatedPath.path],
            extensible: {
                supported: "no",
            },
            entityTypeMappings: [{ entityTypeTargets: appConfig.odmEntity }],

            ...ordExtensions,
        };
        // visibility can also be set as ORD extension, in which case it overwrites the default visibility
        if (obj.visibility === RESOURCE_VISIBILITY.public) apiResources.push(obj);
    });

    return apiResources;
};

const createEventResourceTemplate = (serviceName, eventDefinition, appConfig, packageIds) => {
    const ordExtensions = readORDExtensions(eventDefinition);
    return {
        ordId: `${appConfig.ordNamespace}:eventResource:${serviceName}:v1`,
        title:
            eventDefinition["@title"] ??
            eventDefinition["@Common.Label"] ??
            `ODM ${appConfig.appName.replace(/[^a-zA-Z0-9]/g, "")} Events`,
        shortDescription: `${serviceName} event resource`,
        description:
            eventDefinition['@description'] ?? eventDefinition['@Core.Description'] ??
            "CAP Event resource describing events / messages.",
        version: "1.0.0",
        lastUpdate: appConfig.lastUpdate,
        releaseStatus: "active",
        partOfPackage: _getPackageID(appConfig.ordNamespace, packageIds, 'event'),
        partOfGroups: [_getGroupID(serviceName, defaults.groupTypeId, appConfig)],
        visibility: "public",
        resourceDefinitions: [
            {
                type: "asyncapi-v2",
                mediaType: "application/json",
                url: `/.well-known/open-resource-discovery/v1/api-metadata/${serviceName}.asyncapi2.json`,
                accessStrategies: [
                    {
                        type: "open",
                    },
                ],
            },
        ],
        extensible: { supported: "no" },

        ...ordExtensions
    };
};

function _getPackageID(namespace, packageIds, resourceType) {
    //TODO: without this check, it will be failed in ordPackageJson.test.js, need to check why it is failing
    if (!(packageIds instanceof Set)) return;
    const packageIdsArray = Array.from(packageIds);
    return packageIdsArray.find((pkg) => pkg.includes("-" + resourceType)) || packageIdsArray.find((pkg) => pkg.includes(namespace));
}

module.exports = {
    createEntityTypeTemplate,
    createGroupsTemplateForService,
    createAPIResourceTemplate,
    createEventResourceTemplate,
};
