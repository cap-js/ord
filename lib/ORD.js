const fs = require("fs");
const path = require("path");
const { exists } = cds.utils;
const defaults = require("./defaults");
const {
    fCreateAPIResourceTemplate,
    fCreateEventResourceTemplate,
    fCreateGroupsTemplateForService,
    fCreateGroupsTemplateForEvent,
    fCreateEntityTypeTemplate,
    fCreateIntegrationDependencyTemplate
} = require('./templates');
// let global = {}

/**
 * Initializes global object based on package.json and CSN object.
 * @param {Object} csn object
 * @returns {Object} An object containing global vaiables.
 */
const fInitializeGlobal = (csn) => {
    let packagejsonPath = path.join(cds.root,'package.json')
    let packageJson;
    if (exists(packagejsonPath)) {
        packageJson = require(packagejsonPath);
    } else {
        throw new Error(`package.json not found in the project root directory`);
    }

    const appName = packageJson.name.replace(/\s/g, "-");

    const aModelKeys = Object.keys(csn.definitions);
    const aEvents = [];
    const aServices = [];
    const aODMEntity = [];

    const capNamespace = csn.namespace;
    // namespace variable value if present in cdsrc.json take it there or else from package.json
    const namespace = cds.env["ord"]?.namespace || `customer.${appName}`;
    const application_namespace = cds.env?.export?.asyncapi?.application_namespace;

    if (fGetNamespaceComponents(namespace) !== fGetNamespaceComponents(application_namespace)) {
        console.warn('ORD and AsyncAPI namespaces should be same.')
    }

    const fEventFilter = (keyDefinition) => keyDefinition.kind === "event";
    const fServicesFilter = (keyDefinition) => keyDefinition.kind === "service" && !keyDefinition['@cds.external'];
    const fODMEntityFilter = (key, keyDefinition) => {
        return keyDefinition.kind === "entity"
            && key.includes(capNamespace)
            && !key.includes(".texts")
            && keyDefinition["@ODM.entityName"];
    }

    aModelKeys.forEach((key) => {
        const keyDefinition = csn.definitions[key];
        if(fServicesFilter(keyDefinition)){
            aServices.push(key);
        } else if(fODMEntityFilter(key, keyDefinition)) {
            aODMEntity.push(fCreateEntityTypeTemplate(keyDefinition));
        } else if(fEventFilter(keyDefinition)){
            aEvents.push(key);
        }
    });

    const aIntegrationDependency = Object.values(cds.services).filter((srv) => srv.definition && srv.definition['@cds.external']);

    return {
        env: cds.env["ord"],
        capNamespace,
        appName,
        aEvents,
        aServices,
        aODMEntity,
        aIntegrationDependency,
        namespace,
        application_namespace
    }
}

/**
 * Retrieves first two components of the namespace.
 * @param {string} namespace
 * @returns {string} The first two components of the namespace.
 */
const fGetNamespaceComponents = (namespace) => namespace.split('.').slice(0, 2).join('.');

/**
 * Retrieves the policy level.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {string} The policy level.
 */
const fGetPolicyLevel = () => global.env?.policyLevel || defaults.policyLevel;

/**
 * Retrieves the root level ORD document description.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {string} The ORD document description.
 */
const fGetDescription = () => global.env?.description || defaults.description;

/**
 * Retrieves the products.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {Array<object>} The products array.
 */
const fGetProducts = () => global.env?.products || defaults.products(global.appName);

/**
 * Retrieves the groups that services belongs to.
 * Gets list of groups from CDS runtime object.
 * @param {Object} csn object 
 * @returns {Array<object>} The groups array.
 */
const fGetGroups = (csn) => {
    let serviceGroups = global.aServices
            .map((srv) => fCreateGroupsTemplateForService(srv, csn.definitions[srv]))
            .filter((resource) => resource !== null && resource !== undefined);
    let eventGroups = global.aEvents
            .map((event) => fCreateGroupsTemplateForEvent(event, csn.definitions[event]))
            .filter((resource) => resource !== null && resource !== undefined);

    return [...serviceGroups, ...eventGroups];
};

/**
 * Retrieves the packages.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {Array<object>} The packages array.
 */
const fGetPackages = (policyLevel) => global.env?.packages || (global.aEvents.length) ? defaults.packages(global.appName,policyLevel) : defaults.packages(global.appName,policyLevel).slice(0, 1)

/**
 * Retrieves the consumption bundles.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {Array<object>} The consumption bundles array.
 */
const fGetConsumptionBundles = () => global.env?.consumptionBundles || (global.aEvents.length) ? defaults.consumptionBundles(global.appName) : defaults.consumptionBundles(global.appName).slice(0,1)

/**
 * Retrieves the API Resources
 * Gets list of services from CSN object
 * @param {Object} csn object
 * @returns {Array<object>} The API Resources array.
 */
const fGetAPIResources = (csn) => {
  const apiResources = [];
  global.aServices.forEach((srv) => {
    fCreateAPIResourceTemplate(srv, csn.definitions[srv])?.forEach(
      (resource) => {
        if (resource !== null && resource !== undefined) {
          apiResources.push(resource);
        }
      }
    );
  });
  return apiResources;
};

/**
 * Retrieves the Event Resources
 * Gets list of event from CSN object
 * @param {Object} csn object
 * @returns {Array<object>} The Event Resources array.
 */
const fGetEventResources = (csn) => global.aEvents.map((srv) => fCreateEventResourceTemplate(srv, csn.definitions[srv])).filter((resource) => resource !== null && resource !== undefined);

/**
 * Retrieves the Entity Types
 * Gets list of entity types from CSN object, Select entity having only ODM Anotation
 * @param {Object} csn object 
 * @returns {Array<object>} The Entity Resources array.
 */
const fGetEntityTypes = () => global.aODMEntity;

/**
 * Retrieves the Integration Dependencies
 * @returns {Array<object>} The Integration Dependencies Resources array.
 */
const fGetIntegrationDependencies = () => global.aIntegrationDependency.map((srv) => fCreateIntegrationDependencyTemplate(srv.name));

module.exports = (csn) => {
    const linkedCsn = cds.linked(csn);
    global = fInitializeGlobal(linkedCsn);
    const data = global.namespace;
    const validateSystemNamespace = new RegExp("^" + global.application_namespace + "\.[^.]+\..+$");
    if (data === undefined && !validateSystemNamespace.test(data)) {
        let error = new Error(`Namespace is not defined in cdsrc.json or it is not in the format of ${global.application_namespace}.<appName>.<service>`);
        console.error('Namespace error:', error.message);
        throw error;
    }

    let oReturn = {openResourceDiscovery: "1.9",
        policyLevel: fGetPolicyLevel(),
        description: fGetDescription(),
        products: fGetProducts(),
        groups: fGetGroups(linkedCsn),
    };
    if(fGetAPIResources(linkedCsn).length > 0 && (fGetEventResources(linkedCsn).length>0)){
        oReturn.packages = fGetPackages(oReturn.policyLevel);
    }
    oReturn = {
        ...oReturn,
        consumptionBundles: fGetConsumptionBundles(),
        apiResources: fGetAPIResources(linkedCsn)
      };
    };
    if(fGetEventResources(linkedCsn).length > 0) {
        oReturn.eventResources= fGetEventResources(linkedCsn);
    }

    oReturn.integrationDependencies = fGetIntegrationDependencies();
    return oReturn;
}
