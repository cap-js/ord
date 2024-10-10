const defaults = require("./defaults");
const cds = require("@sap/cds");

/**
 * Reads the ORD (Open Resource Discovery) annotation from a given service definition object and returns them as an object.
 *
 * @param {Object} srv The service definition object.
 * @returns {Object} An object containing ORD annotation.
 */
const readORDExtensions = (srv) =>
    Object.entries(srv)
        .filter(([key]) => key.startsWith("@ORD.Extensions."))
        .reduce(
            (ordExtensions, [key, value]) => ({
                ...ordExtensions,
                [key.slice("@ORD.Extensions.".length)]: value,
            }),
            {}
        );

/**
 * Reads the service definition and returns an array of entryPoint paths.
 *
 * @param {string} srv The service definition name.
 * @param {Object} srvDefinition The service definition object.
 * @returns {Array} An array containing paths and it's kind.
 */

const generatePaths = (srv, srvDefinition) => {
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
    const paths = generatePaths(serviceName, serviceDefinition);
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
                ordExtensions.title ??
                serviceDefinition["@title"] ??
                serviceDefinition["@Common.Label"] ??
                serviceName,
            shortDescription: ordExtensions.shortDescription ?? serviceName,
            description:
                ordExtensions.description ??
                serviceDefinition["@Core.Description"] ??
                serviceName,
            version: ordExtensions.version ?? "1.0.0",
            visibility: ordExtensions.visibility ?? "public",
            partOfPackage: _getPackageID(appConfig.ordNamespace, packageIds, "api"),
            partOfGroups: [_getGroupID(serviceName, defaults.groupTypeId, appConfig)],
            releaseStatus: ordExtensions.active ?? "active",
            apiProtocol:
                generatedPath.kind === "odata" ? "odata-v4" : generatedPath.kind,
            resourceDefinitions: resourceDefinitions,
            entryPoints: [generatedPath.path],
            extensible: {
                supported: ordExtensions["extensible.supported"] ?? "no",
            },
            entityTypeMappings: [{ entityTypeTargets: appConfig.aODMEntity }],
        };

        apiResources.push(obj);
    });

    if (apiResources.length > 0) return apiResources;
};

/**
 * This is a template function to create Event Resource object for Event Resource Array.
 *
 * @param {string} eventName The name of the event.
 * @param {object} eventDefinition The definition of the event.
 * @returns {Object} An object for the Event Resource.
 */
// TODO: wrong name srvDefinition, should be model
const createEventResourceTemplate = (eventName, eventDefinition, appConfig, packageIds) => {
    const ordExtensions = readORDExtensions(eventDefinition);
    return {
        ordId: `${appConfig.ordNamespace}:eventResource:${eventName}:v1`,
        title:
            ordExtensions.title ??
            eventDefinition["@title"] ??
            eventDefinition["@Common.Label"] ??
            `ODM ${appConfig.appName.replace(/[^a-zA-Z0-9]/g, "")} Events`,
        shortDescription: ordExtensions.shortDescription ?? "Example ODM Event",
        description: ordExtensions.description ??
            eventDefinition['@description'] ?? eventDefinition['@Core.Description'] ??
            "CAP Event resource describing events / messages.",
        version: ordExtensions.version ?? "1.0.0",
        releaseStatus: ordExtensions.releaseStatus ?? "beta",
        partOfPackage: _getPackageID(appConfig.ordNamespace, packageIds, 'event'),
        partOfGroups: [_getGroupID(eventName, defaults.groupTypeId, appConfig)],
        visibility: ordExtensions.visibility ?? "public",
        resourceDefinitions: [
            {
                type: "asyncapi-v2",
                mediaType: "application/json",
                url: `/.well-known/open-resource-discovery/v1/api-metadata/${eventName}.asyncapi2.json`,
                accessStrategies: [
                    {
                        type: "open",
                    },
                ],
            },
        ],
        extensible: { supported: ordExtensions["extensible.supported"] ?? "no" },
    };
};

/**
 * This is a function to get the corresponding package ordId mapped to the service.
 */

function _getPackageID(namespace, packageIds, apiOrEvent) {
    if (packageIds instanceof Set) {
        const packageArray = Array.from(packageIds);

        if (apiOrEvent === "api") {
            const apiPackage = packageArray.find((pkg) => pkg.includes("-api"));
            if (apiPackage) return apiPackage;
        } else if (apiOrEvent === "event") {
            const eventPackage = packageArray.find((pkg) => pkg.includes("-event"));
            if (eventPackage) return eventPackage;
        }

        return packageArray.find(pkg => pkg.includes(namespace));
    }
}

module.exports = {
    createEntityTypeTemplate,
    createGroupsTemplateForService,
    createAPIResourceTemplate,
    createEventResourceTemplate,
};
