const defaults = require("./defaults");
const cds = require("@sap/cds");

/**
 * Reads the ORD (Open Resource Discovery) annotation from a given service definition object and returns them as an object.
 *
 * @param {Object} srv The service definition object.
 * @returns {Object} An object containing ORD annotation.
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
const fCreateEntityTypeTemplate = (entity) => ({
  ordId: `sap.odm:entityType:${entity["@ODM.entityName"]}:v1`,
});

/**
 * This is a template function to form the group id.
 *
 * @param {string} fullyQualifiedName The fully qualified name of the service or event.
 * @param {string} groupTypeId The group type id.
 * @returns {string} a group id.
 */
function _getGroupID(
  fullyQualifiedName,
  groupTypeId = defaults.groupTypeId,
  isService = true
) {
  if (isService) {
    return `${groupTypeId}:${global.ordNamespace}:${fullyQualifiedName}`;
  } else {
    return (
      `${groupTypeId}:${global.ordNamespace}:` +
      `${fullyQualifiedName.slice(0, fullyQualifiedName.lastIndexOf("."))}`
    );
  }
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
const fCreateGroupsTemplateForService = (serviceName, serviceDefinition) => {
    const ordExtensions = fReadORDExtensions(serviceDefinition);

    if(!serviceDefinition) {
      console.warn("Unable to find service definition:", serviceName)
      return undefined
    }

    if (serviceDefinition && checkEntityFunctionAction(serviceDefinition, global).length > 0) {
      let groupId = _getGroupID(serviceName, defaults.groupTypeId);
      return {
          groupId: groupId,
          groupTypeId: `${defaults.groupTypeId}`,
          title: ordExtensions.title ?? _getTitleFromServiceName(serviceName)
      };
    }
  }

/**
 *
 * @param {string} event The name of the event.
 * @returns {string} The title of the event group.
 */
function _getEventTitle(event) {
  let serviceName = event.substring(0, event.lastIndexOf("."));
  return _getTitleFromServiceName(serviceName);
}

/**
 * This is a template function to create group object of an event for groups array in ORD doc.
 *
 * @param {string} eventName The name of the event.
 * @param {object} eventDefinition The definition of the event.
 * @param {Set} groupIds A set of group ids.
 * @returns {Object} A group object.
 */
const fCreateGroupsTemplateForEvent = (eventName, eventDefinition, groupIds) => {
  const ordExtensions = fReadORDExtensions(eventDefinition);
  let groupId = _getGroupID(
    eventName,
    defaults.groupTypeId,
    global,
    false
  );
  if (groupIds.has(groupId)) {
    return null;
  } else {
    groupIds.add(groupId);
    return {
      groupId: groupId,
      groupTypeId: `${defaults.groupTypeId}`,
      title: ordExtensions.title ?? _getEventTitle(eventName),
    };
  }
};

/**
 * This is a template function to create API Resource object for API Resource Array.
 *
 * @param {string} serviceName The name of the service.
 * @param {object} serviceDefinition The definition of the service
 * @returns {Array} An array of objects for the API Resources.
 */
const fCreateAPIResourceTemplate = (serviceName, serviceDefinition, global, packageIds) => {
  const ordExtensions = fReadORDExtensions(serviceDefinition);
  const paths = fGeneratePaths(serviceName, serviceDefinition);
  const apiResources = [];

  if (checkEntityFunctionAction(serviceDefinition, global).length > 0) {
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
        ordId: `${global.ordNamespace}:apiResource:${serviceName}:v1`,
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
        partOfPackage: _getPackageID(global.ordNamespace, packageIds, "api"),
        partOfGroups: [_getGroupID(serviceName, defaults.groupTypeId, global)],
        releaseStatus: ordExtensions.active ?? "active",
        apiProtocol:
          generatedPath.kind === "odata" ? "odata-v4" : generatedPath.kind,
        resourceDefinitions: resourceDefinitions,
        entryPoints: [generatedPath.path],
        extensible: {
          supported: ordExtensions["extensible.supported"] ?? "no",
        },
        entityTypeMappings: [{ entityTypeTargets: global.aODMEntity }],
      };

      apiResources.push(obj);
    });
  }
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
const fCreateEventResourceTemplate = (eventName, eventDefinition, global,packageIds) => {
  const ordExtensions = fReadORDExtensions(eventDefinition);
  return {
    ordId: `${global.ordNamespace}:eventResource:${eventName}:v1`,
    title:
      ordExtensions.title ??
      eventDefinition["@title"] ??
      eventDefinition["@Common.Label"] ??
      `ODM ${global.appName.replace(/[^a-zA-Z0-9]/g, "")} Events`,
    shortDescription: ordExtensions.shortDescription ?? "Example ODM Event",
    description:  ordExtensions.description ??
                  eventDefinition['@description'] ?? eventDefinition['@Core.Description'] ??
                  "CAP Event resource describing events / messages.",
    version:  ordExtensions.version ?? "1.0.0",
    releaseStatus:  ordExtensions.releaseStatus ?? "beta",
    partOfPackage: _getPackageID(global.ordNamespace, packageIds,'event'),
    partOfGroups: [_getGroupID(eventName, defaults.groupTypeId, global, false)],
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
 * This is a function to check whether entity is a function or action.
 * @param {object} srvDefinition The definition of the event.
 * @returns {Object} An object for the Event Resource.
 */
// TODO: the name srvDefinition is wrong, it should be model
function checkEntityFunctionAction(srvDefinition, global) {
  if (srvDefinition.entities) {
    return [...srvDefinition.entities].map((entity) => {
      return {
        type: "entity",
        name: entity.name,
        entityType: entity.name,
        entitySet: entity.name,
        entityTypeMapping: `${global.ordNamespace}:entityType:${entity.name}:v1`,
        entitySetMapping: `${global.ordNamespace}:entitySet:${entity.name}:v1`,
      };
    });
  } else if (srvDefinition.actions) {
    return srvDefinition.actions.map((action) => {
      return {
        type: "action",
        name: action.name,
        actionType: action.name,
        actionMapping: `${global.ordNamespace}:action:${action.name}:v1`,
      };
    });
  } else if (srvDefinition.functions) {
    return srvDefinition.functions.map((func) => {
      return {
        type: "function",
        name: func.name,
        functionType: func.name,
        functionMapping: `${global.ordNamespace}:function:${func.name}:v1`,
      };
    });
  }
}

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
  fCreateEntityTypeTemplate,
  fCreateGroupsTemplateForService,
  fCreateGroupsTemplateForEvent,
  fCreateAPIResourceTemplate,
  fCreateEventResourceTemplate,

  // TODO: remove these functions after finished testing, this is temporary for unittesting
  checkEntityFunctionAction
};
