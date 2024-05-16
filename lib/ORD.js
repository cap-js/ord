const fs = require("fs");
const path = require("path");
const defaults = require("./defaults")
const {
    fCreateAPIResourceTemplate,
    fCreateEventResourceTemplate,
    fCreateEntityTypeTemplate,
    fCreateIntegrationDependencyTemplate
} = require('./templates')
// let global = {}

/**
 * Initializes global object based on package.json and CDS runtime object.
 * @returns {Object} An object containing global vaiables.
 */
const fInitializeGlobal = (csn) => {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    const appName = packageJson.name.replace(/\s/g, "-");

    const aDefinitions = Object.keys(csn.definitions);
    const aEvents = [];
    const aServices = [];
    const aODMEntity = [];


    const namespace = csn.namespace;

    const fEventFilter = (keyDefinition) => keyDefinition.kind === "event";
    const fServicesFilter = (keyDefinition) => keyDefinition.kind === "service" && !keyDefinition['@cds.external'];
    const fODMEntityFilter = (key, keyDefinition) => {
        return keyDefinition.kind === "entity"
            && key.includes(namespace)
            && !key.includes(".texts")
            && keyDefinition["@ODM.entityName"];
    }

    aDefinitions.forEach((key) => {
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
        packageNameReg: "sap.capordpoc",
        namespace,
        appName,
        aEvents,
        aServices,
        aODMEntity
    }
}

/**
 * Retrieves the policy level.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {string} The policy level.
 */
const fGetPolicyLevel = () => global.env.policyLevel || defaults.policyLevel;

/**
 * Retrieves the root level ORD document description.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {string} The ORD document description.
 */
const fGetDescription = () => global.env.description || defaults.description;

/**
 * Retrieves the products.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {Array<object>} The products array.
 */
const fGetProducts = () => global.env.products || defaults.products(global.appName);

/**
 * Retrieves the packages.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {Array<object>} The packages array.
 */
const fGetPackages = () => global.env.packages || (global.aEvents.length) ? defaults.packages(global.appName) : defaults.packages(global.appName).slice(0, 1)

/**
 * Retrieves the consumption bundles.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {Array<object>} The consumption bundles array.
 */
const fGetConsumptionBundles = () => global.env.consumptionBundles || defaults.consumptionBundles;

/**
 * Retrieves the API Resources
 * Gets list of services from CDS runtime object
 * @returns {Array<object>} The API Resources array.
 */
const fGetAPIResources = (csn) => global.aServices.map((srv) => fCreateAPIResourceTemplate(srv, csn.definitions[srv]));

/**
 * Retrieves the Event Resources
 * Gets list of event from CDS runtime object
 * @returns {Array<object>} The Event Resources array.
 */
const fGetEventResources = (csn) => global.aEvents.map((srv) => fCreateEventResourceTemplate(srv, csn.definitions[srv]));

/**
 * Retrieves the Entity Types
 * Gets list of entity types from CDS runtime object, Select entity having only ODM Anotation 
 * @returns {Array<object>} The Entity Resources array.
 */
const fGetEntityTypes = () => global.aODMEntity;

module.exports = (csn) => {
    try {
        global = fInitializeGlobal(csn)
        const data = global.env?.application_namespace;
        if (data === undefined) {
            return { status: "Error" }
        }
        const oReturn = {
            openResourceDiscovery: "1.6",
            policyLevel: fGetPolicyLevel(),
            description: fGetDescription(),
            products: fGetProducts(),
            packages: fGetPackages(),
            consumptionBundles: fGetConsumptionBundles(),
            apiResources: fGetAPIResources(csn),
            eventResources: fGetEventResources(csn),
            entityTypes: fGetEntityTypes()
        };
        return oReturn;
    } catch (error) {
        console.log(error);
    }
}



