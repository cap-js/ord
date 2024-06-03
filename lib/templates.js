const defaults = require("./defaults");

/**
 * Reads the ORD (Open Resource Discovery) annotation from a given service definition object and returns them as an object.
 *
 * @param {Object} srv The service definition object.
 * @returns {Object} An object containing ORD anotation.
 */
const fReadORDExtensions = (srv) =>
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

const fGeneratePaths = (srv, srvDefinition) => {
  const srvObj = { name: srv, definition: srvDefinition };
  const protocols = cds.service.protocols;

  const paths = protocols.endpoints4(srvObj);

  return paths;
};

/**
 * This is a template function to create Entity Type object for Entity Type Array.
 *
 * @param {string} entity The name of the entity.
 * @returns {Object} An object for the entity type.
 */
const fCreateEntityTypeTemplate = (entity) => ({
  ordId: `sap.odm:entityType:${entity["@ODM.entityName"]}:v1`,
});

/**
 * This is a template function to form the group id.
 * 
 * @param {Object} ordExtensions The ORD extensions object.
 * @param {string} srv The name of the service.
 * @returns {string} a group id.
 */
function _getGroupID(ordExtensions, srv) {
    return `${ordExtensions.groupTypeId ?? defaults.groupTypeId}:${global.namespace}:${global.capNamespace}.${srv}`;
}


/**
 * This is a function to resolve the title of the group.
 * 
 * @param {string} srv The name of the service.
 * @returns {string} The title of the group.
 */
function _getTitleFromService(srv) {
    let index = srv.indexOf("Service");
    if (index >= 0) {
        return `${srv.substring(0, index)} Service Title`;
    } else {
        return `${srv} Service Title`;
    }
}


/**
 * This is a template function to create group object for groups array in ORD doc.
 * 
 * @param {string} srv The name of the service.
 * @param {object} srvDefinition The definition of the service
 * @returns {Object} A group object.
 */
const fCreateGroupsTemplate = (srv, srvDefinition) => {
    const ordExtensions = fReadORDExtensions(srvDefinition);

    if (checkEntityFunctionAction(srvDefinition).length > 0) {
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
 * @param {object} srvDefinition The definition of the service
 * @returns {Object} An object for the API Resource.
 */
const fCreateAPIResourceTemplate = (srv, srvDefinition) => {
  const ordExtensions = fReadORDExtensions(srvDefinition);
  const paths = fGeneratePaths(srv, srvDefinition);
  let srvName = srv;
  if(!srvName.includes(global.capNamespace)){
    srvName = global.capNamespace + "." + srv;
  }

  if (checkEntityFunctionAction(srvDefinition).length > 0) {
    return {
      ordId: `${global.namespace}:apiResource:${srvName}:v1`,
      title: ordExtensions.title ?? `The service is for ${srv}`,
      shortDescription:
      ordExtensions.shortDescription ??
        `Here we have the shortDescription for ${srv}`,
      description:
      ordExtensions.description ?? `Here we have the description for ${srv}`,
      version: ordExtensions.version ?? "1.0.0",
      visibility: ordExtensions.visibility ?? "public",
      partOfPackage: `${global.namespace}:service:${global.capNamespace}.${srv}:v1`,
      partOfGroups: _getGroupID(ordExtensions, srv),
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
      entryPoints: paths,
      extensible: { supported: ordExtensions["extensible.supported"] ?? "no" },
      entityTypeMappings: [ { entityTypeTargets: global.aODMEntity }]
    };
  }
};

/**
 * This is a template function to create Event Resource object for Event Resource Array.
 *
 * @param {string} srv The name of the event.
 * @param {object} srvDefinition The definition of the event.
 * @returns {Object} An object for the Event Resource.
 */
const fCreateEventResourceTemplate = (srv, srvDefinition) => {
  const ordExtensions = fReadORDExtensions(srvDefinition);
  let srvName = srv;
  if(!srvName.includes(global.capNamespace)){
    srvName = global.capNamespace + "." + srv;
  }

  return {
    ordId: `${global.namespace}:eventResource:${srvName}:v1`,
    title: ordExtensions.title ?? `ODM ${global.appName} Events`,
    shortDescription: ordExtensions.shortDescription ?? "Example ODM Event",
    description:
    ordExtensions.description ??
      `This is an example event catalog that contains only a partial ODM ${global.appName} V1 event`,
    version: ordExtensions.version ?? "1.0.0",
    releaseStatus: ordExtensions.releaseStatus ?? "beta",
    partOfPackage: `${global.namespace}:package:${global.appName}:v1`,
    visibility: ordExtensions.visibility ?? "public",
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
    extensible: { supported: ordExtensions["extensible.supported"] ?? "no" },
  };
};


/**
 * This is a function to check whether entity is a function or action.
 * @param {object} srvDefinition The definition of the event.
 * @returns {Object} An object for the Event Resource.
 */
function checkEntityFunctionAction(srvDefinition) {
  if (srvDefinition.entities) {
    return srvDefinition.entities.map((entity) => {
      return {
        type: "entity",
        name: entity.name,
        entityType: entity.name,
        entitySet: entity.name,
        entityTypeMapping: `${global.namespace}:entityType:${entity.name}:v1`,
        entitySetMapping: `${global.namespace}:entitySet:${entity.name}:v1`,
      };
    });
  } else if (srvDefinition.actions) {
    return srvDefinition.actions.map((action) => {
      return {
        type: "action",
        name: action.name,
        actionType: action.name,
        actionMapping: `${global.namespace}:action:${action.name}:v1`,
      };
    });
  } else if (srvDefinition.functions) {
    return srvDefinition.functions.map((func) => {
      return {
        type: "function",
        name: func.name,
        functionType: func.name,
        functionMapping: `${global.namespace}:function:${func.name}:v1`,
      };
    });
  }
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
  fCreateEntityTypeTemplate,
  fCreateGroupsTemplate,
  fCreateAPIResourceTemplate,
  fCreateEventResourceTemplate,
};
