const defaults = require("./defaults");

/**
 * Reads the ORD (Open Resource Discovery) annotation from a given service definition object and returns them as an object.
 * 
 * @param {Object} srv The service definition object.
 * @returns {Object} An object containing ORD anotation.
 */
const fReadORDExtensions = (srv) => Object.entries(srv)
                                          .filter(([key]) => key.startsWith("@ORD.Extensions."))
                                          .reduce((ordExtensions, [key, value]) => ({ ...ordExtensions, [key.slice("@ORD.Extensions.".length)]: value }), {});


/**
 * This is a template function to create Entity Type object for Entity Type Array.
 * 
 * @param {string} entity The name of the entity.
 * @returns {Object} An object for the entity type.
 */
const fCreateEntityTypeTemplate = (entity) => ({ ordId: `sap.odm:entityType:${cds.model.definitions[entity]["@ODM.entityName"]}:v1` })


/**
 * This is a template function to create Groups object for groups array in ORD doc.
 * 
 * @param {string} srv The name of the service.
 * @returns {Object} An group object.
 */

function _getGroupID(ordExtensions, srv) {
    return `${ordExtensions.groupTypeId ?? defaults.groupTypeId}:${global.namespace}:${global.cap_namespace}.${srv}:v1`;
}

function _getTitleFromService(srv) {
    let index = srv.indexOf("Service");
    if (index >= 0) {
        return `${srv.substring(0, index)} Service Title`;
    } else {
        return `${srv} Service Title`;
    }
}

const fCreateGroupsTemplate = (srv) => {
    const ordExtensions = fReadORDExtensions(cds.model.definitions[srv]);

    if (checkEntityFunctionAction(srv).length > 0) {
        return {
            groupId: _getGroupID(ordExtensions, srv),
            groupTypeId: `${ordExtensions.groupTypeId ?? defaults.groupTypeId}`,
            title: ordExtensions.groupTitle ?? _getTitleFromService(srv),
        };
    }
}

/**
 * This is a template function to create API Resource object for API Resource Array.
 * 
 * @param {string} srv The name of the service.
 * @returns {Object} An object for the API Resource.
 */

const fCreateAPIResourceTemplate = (srv) => {
    const ordExtensions = fReadORDExtensions(cds.model.definitions[srv]);

    if (checkEntityFunctionAction(srv).length > 0) {
        return {
            ordId: `${global.namespace}:apiResource:${global.cap_namespace}.${srv}:v1`,
            title: ordExtensions.title ?? `The service is for ${srv}`,
            shortDescription: ordExtensions.shortDescription ?? `Here we have the shortDescription for ${srv}`,
            description: ordExtensions.description ?? `Here we have the description for ${srv}`,
            version: ordExtensions.version ?? "1.0.0",
            visibility: ordExtensions.visibility ?? "public",
            partOfPackage: _getGroupID(ordExtensions, srv),
            partOfGroups: `${global.namespace}:service:${global.cap_namespace}.${srv}:v1`,
            releaseStatus: ordExtensions.active ?? "active",
            partOfConsumptionBundles: [
                {
                    ordId: `${global.namespace}:consumptionBundle:noAuth:v1`,
                },
            ],
            apiProtocol: ordExtensions.apiProtocol ?? "odata-v4",
            resourceDefinitions: [
                {
                    type: "openapi-v3",
                    mediaType: "application/json",
                    url: `/.well-known/open-resource-discovery/v1/api-metadata/${srv}.oas3.json`,
                    accessStrategies: [{ type: "open" }],
                },
                {
                    type: "edmx",
                    mediaType: "application/xml",
                    url: `/.well-known/open-resource-discovery/v1/api-metadata/${srv}.edmx`,
                    accessStrategies: [{ type: "open" }],
                },
            ],
            entryPoints: [cds.services[srv].path],
            extensible: { supported: ordExtensions['extensible.supported'] ?? "no" },
            entityTypeMappings: global.aODMEntity
        };
    }
}


/**
 * This is a template function to create Event Resource object for Event Resource Array.
 * 
 * @param {string} srv The name of the event.
 * @returns {Object} An object for the Event Resource.
 */
const fCreateEventResourceTemplate = (srv) => {
    const ordExtensions = fReadORDExtensions(cds.model.definitions[srv]);
    return {
        ordId: `${global.namespace}:eventResource:${global.cap_namespace}.${srv}:v1`,
        title: ordExtensions.title ?? `ODM ${global.appName} Events`,
        shortDescription: ordExtensions.shortDescription ?? "Example ODM Event",
        description: ordExtensions.description ?? `This is an example event catalog that contains only a partial ODM ${global.appName} V1 event`,
        version: ordExtensions.version ?? "1.0.0",
        releaseStatus: ordExtensions.releaseStatus ?? "beta",
        partOfPackage: `${global.namespace}:package:${global.appName}:v1`,
        visibility: ordExtensions.visibility ?? "public",
        resourceDefinitions: [
            {
                type: "asyncapi-v2",
                mediaType: "application/json",
                url: `/.well-known/open-resource-discovery/v1/api-metadata/${cds.model.definitions[srv]._service.name}.asyncapi2.json`,
                accessStrategies: [
                    {
                        type: "open",
                    },
                ],
            },
        ],
        extensible: { supported: ordExtensions['extensible.supported'] ?? "no" },
    };
}

//Check if the service has entities, actions or functions

function checkEntityFunctionAction(srv) {
    if (cds.services[srv].entities) {
        return cds.services[srv].entities.map((entity) => {
            return {
                type: "entity",
                name: entity.name,
                entityType: entity.name,
                entitySet: entity.name,
                entityTypeMapping: `${global.namespace}:entityType:${entity.name}:v1`,
                entitySetMapping: `${global.namespace}:entitySet:${entity.name}:v1`,
            }
        })
    } else if (cds.services[srv].actions) {
        return cds.services[srv].actions.map((action) => {
            return {
                type: "action",
                name: action.name,
                actionType: action.name,
                actionMapping: `${global.namespace}:action:${action.name}:v1`,
            }
        })
    } else if (cds.services[srv].functions) {
        return cds.services[srv].functions.map((func) => {
            return {
                type: "function",
                name: func.name,
                functionType: func.name,
                functionMapping: `${global.namespace}:function:${func.name}:v1`,
            }
        })
    }
}


// //Constructing the entityTypes array
// //For POC this is in draft only
// function createEntityTypeTemplate(srv, namespace) {
//     return {
//         ordId: `${namespace}:entityType:${srv}:v1`,
//         localId: "Incidents",
//         version: "1.0.0",
//         title: "Incidents",
//         level: "aggregate",
//         description: "Description of the local Incidents Model",
//         visibility: "public",
//         releaseStatus: "active",
//         partOfPackage: "sap.capordpoc:package:ord-reference-app-apis:v1",
//     };
// }

module.exports = {
    fCreateEntityTypeTemplate: fCreateEntityTypeTemplate,
    fCreateGroupsTemplate: fCreateGroupsTemplate,
    fCreateAPIResourceTemplate: fCreateAPIResourceTemplate,
    fCreateEventResourceTemplate: fCreateEventResourceTemplate
}