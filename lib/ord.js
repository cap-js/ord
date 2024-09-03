const path = require("path");
const cds = require("@sap/cds");
const { exists } = cds.utils;
const defaults = require("./defaults");
const {
    fCreateAPIResourceTemplate,
    fCreateEventResourceTemplate,
    fCreateGroupsTemplateForService,
    fCreateEntityTypeTemplate
} = require('./templates');

/**
 * Initializes global object based on package.json and CSN object.
 * @param {Object} csn object
 * @returns {Object} An object containing global variables.
 */
const fInitializeGlobal = (csn) => {
    let packagejsonPath = path.join(cds.root,'package.json')
    let packageJson;
    if (exists(packagejsonPath)) {
        packageJson = require(packagejsonPath);
    } else {
        throw new Error(`package.json not found in the project root directory`);
    }
    const packageName = packageJson.name;
    const appName = packageJson.name.replace(/^[@]/, "").replace(/[@/]/g, "-");
    const aModelKeys = Object.keys(csn.definitions);
    const aEvents = [];
    const aServices = [];
    const aODMEntity = [];
    
    const capNamespace = csn.namespace;
     // namespace variable value if present in cdsrc.json take it there or else from package.json
    //if cdsrc.json does not have applicationNamespace, then use just the namespace
    const namespace = cds.env["ord"]?.namespace || packageName.replace(/[^\w/]/g, "").replace(/\//, ".");
    const applicationNamespace = cds.env?.export?.asyncapi?.applicationNamespace;
    
    if (applicationNamespace && fGetNamespaceComponents(namespace) !== fGetNamespaceComponents(applicationNamespace)) {
        console.warn('ORD and AsyncAPI namespaces should be the same.');
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


    return {
        env: cds.env["ord"],
        capNamespace,
        appName,
        aEvents,
        aServices,
        aODMEntity,
        namespace,
        applicationNamespace,
        packageName
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
const fGetPolicyLevel = (global) => global.env?.policyLevel || defaults.policyLevel;

/**
 * Retrieves the root level ORD document description.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {string} The ORD document description.
 */
const fGetDescription = (global) => global.env?.description || defaults.description;

/**
 * Retrieves the products.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {Array<object>} The products array.
 * if global.namespace is defined in cdsrc.json, then use it, else use the appName from package.json
 */
const fGetProducts = (global) => global.env?.products || defaults.products(global.packageName);

/**
 * Retrieves the groups that services belongs to.
 * Gets list of groups from CDS runtime object.
 * @param {Object} csn object 
 * @returns {Array<object>} The groups array.
 */
const fGetGroups = (csn, global) => {
    // storing the group ids in a set to avoid duplicates
    let groupIds = new Set();

    return global.aServices
            .map((srv) => fCreateGroupsTemplateForService(srv, csn.definitions[srv], groupIds))
            .filter((resource) => resource !== null && resource !== undefined);
};

/**
 * Retrieves the packages.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {Array<object>} The packages array.
 */
const fGetPackages = (policyLevel,global) => global.env?.packages || (global.aEvents.length) ? defaults.packages(global.namespace,policyLevel,global.capNamespace) : defaults.packages(global.namespace,policyLevel,global.capNamespace).slice(0, 1)

/**
 * Retrieves the API Resources
 * Gets list of services from CSN object
 * @param {Object} csn object
 * @returns {Array<object>} The API Resources array.
 */
const fGetAPIResources = (csn, global,packageIds) => {
  const apiResources = [];
  global.aServices.forEach((srv) => {
    fCreateAPIResourceTemplate(srv, csn.definitions[srv], global,packageIds)?.forEach(
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
const fGetEventResources = (csn, global, packageIds) => {
    if(global.aEvents.length === 0) return []

    const services = []
    for (const serviceName of global.aServices) {
        const hasEvents = global.aEvents.find((eventName) => eventName.startsWith(serviceName));
        if (hasEvents) {
            services.push(serviceName)
        }
    }

    return services.map((serviceName) => fCreateEventResourceTemplate(serviceName, csn.definitions[serviceName], global, packageIds))
};

module.exports = (csn) => {
    const linkedCsn = cds.linked(csn);
    Object.assign(global, fInitializeGlobal(linkedCsn));
    const validateSystemNamespace = new RegExp(`^${global.applicationNamespace}\\.[^.]+\\..+$`);
    if (global.namespace === undefined && !validateSystemNamespace.test(global.namespace)) {
        let error = new Error(`Namespace is not defined in cdsrc.json or it is not in the format of ${global.applicationNamespace}.<appName>.<service>`);
        console.error('Namespace error:', error.message);
        throw error;
    }

    let oReturn = { $schema: "https://sap.github.io/open-resource-discovery/spec-v1/interfaces/Document.schema.json",
        openResourceDiscovery: "1.9",
        policyLevel: fGetPolicyLevel(global),
        description: fGetDescription(global),
        products: fGetProducts(global),
        groups: fGetGroups(linkedCsn, global),
    };
    if(fGetAPIResources(linkedCsn, global).length > 0 && (fGetEventResources(linkedCsn, global).length>0)){
        oReturn.packages = fGetPackages(oReturn.policyLevel, global);
    }

    // check if oReturn.packages is defined and extract the ordId from the packages and store in a set
    let packageIds = new Set();
    if(oReturn.packages){
        oReturn.packages.forEach((pkg) => {
            packageIds.add(pkg.ordId);
        });
    }
    oReturn = {
        ...oReturn,
        apiResources: fGetAPIResources(linkedCsn, global,packageIds),
    };
    if(fGetEventResources(linkedCsn, global,packageIds).length > 0) {
        oReturn.eventResources= fGetEventResources(linkedCsn, global,packageIds);
    }
    return oReturn;
}
