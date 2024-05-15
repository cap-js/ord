
/**
 * Reads the ORD (Open Resource Discovery) anotation from a given service definition object and returns them as an object.
 * 
 * @param {Object} srv The service definition object.
 * @returns {Object} An object containing ORD anotation.
 */
const fReadORDExtensions = (srv) => Object.entries(srv)
                                          .filter(([key]) => key.startsWith("@ORD.Extensions."))
                                          .reduce((ordExtent, [key, value]) => ({ ...ordExtent, [key.slice("@ORD.Extensions.".length)]: value }), {});

/**
 * Reads the service definition and returns an array of entryPoint paths.
 * 
 * @param {string} srv The service definition name.
 * @param {Object} srvDefinition The service definition object.
 * @returns {Array} An array containing paths.
 */

const fGeneratePaths = (srv, srvDefinition) => {
    const srvObj = { name: srv, definition: srvDefinition};
    const paths = [];
    const protocols = cds.service.protocols;
    
    const kindPaths = protocols.endpoints4(srvObj);

    kindPaths.forEach((pathObject) => {
        paths.push(pathObject.path);
    });

    return paths;

}                                        


/**
 * This is a template function to create Entity Type object for Entity Type Array.
 * 
 * @param {string} entity The name of the entity.
 * @returns {Object} An object for the entity type.
 */
const fCreateEntityTypeTemplate = (entity) => ({ ordId: `sap.odm:entityType:${entity["@ODM.entityName"]}:v1` })


/**
 * This is a template function to create API Resource object for API Resource Array.
 * 
 * @param {string} srv The name of the service.
 * @param {object} srvDefinition The definition of the service
 * @returns {Object} An object for the API Resource.
 */
const fCreateAPIResourceTemplate = (srv, srvDefinition) => {
    const ordExtent =fReadORDExtensions(srvDefinition);
    const paths = fGeneratePaths(srv, srvDefinition);
    return {
        ordId: `${global.packageNameReg}:apiResource:${global.namespace}.${srv}:v1`,
        title: ordExtent.title ?? `The service is for ${srv}`,
        shortDescription: ordExtent.shortDescription ?? `Here we have the shortDescription for ${srv}`,
        description: ordExtent.description ?? `Here we have the description for ${srv}`,
        version: ordExtent.version ?? "1.0.0",
        visibility: ordExtent.visibility ?? "public",
        partOfPackage: `${global.packageNameReg}:package:${global.appName}:v1`,
        releaseStatus: ordExtent.active ?? "active",
        partOfConsumptionBundles: [
            {
                ordId: `${global.packageNameReg}:consumptionBundle:noAuth:v1`,
            },
        ],
        apiProtocol: ordExtent.apiProtocol ?? "odata-v4",
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
        entryPoints: paths,
        extensible: { supported: ordExtent['extensible.supported'] ?? "no" },
        entityTypeMappings: global.aODMEntity,
    };
}

/**
 * This is a template function to create Event Resource object for Event Resource Array.
 * 
 * @param {string} srv The name of the event.
 * @param {object} srvDefinition The definition of the event.
 * @returns {Object} An object for the Event Resource.
 */
const fCreateEventResourceTemplate = (srv, srvDefinition) => {
    const ordExtent = fReadORDExtensions(srvDefinition);
    return {
        ordId: `${global.packageNameReg}:eventResource:${global.namespace}.${srv}:v1`,
        title: ordExtent.title ?? `ODM ${global.appName} Events`,
        shortDescription: ordExtent.shortDescription ?? "Example ODM Event",
        description: ordExtent.description ?? `This is an example event catalog that contains only a partial ODM ${global.appName} V1 event`,
        version: ordExtent.version ?? "1.0.0",
        releaseStatus: ordExtent.releaseStatus ?? "beta",
        partOfPackage: `${global.packageNameReg}:package:${global.appName}:v1`,
        visibility: ordExtent.visibility ?? "public",
        resourceDefinitions: [
            {
                type: "asyncapi-v2",
                mediaType: "application/json",
                url: `/.well-known/open-resource-discovery/v1/api-metadata/${srvDefinition._service.name}.asyncapi2.json`,
                accessStrategies: [
                    {
                        type: "open",
                    },
                ],
            },
        ],
        extensible: { supported: ordExtent['extensible.supported'] ?? "no" },
    };
}

// //Constructing the entityTypes array
// //For POC this is in draft only
// function createEntityTypeTemplate(srv, packageNameReg) {
//     return {
//         ordId: `${packageNameReg}:entityType:${srv}:v1`,
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
    fCreateAPIResourceTemplate: fCreateAPIResourceTemplate,
    fCreateEventResourceTemplate: fCreateEventResourceTemplate
}