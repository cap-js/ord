const fs = require("fs");
const path = require("path");
const defaults = require("./defaults");
const {
    fCreateAPIResourceTemplate,
    fCreateEventResourceTemplate,
    fCreateEntityTypeTemplate
} = require('./templates');
// let global = {}

/**
 * Initializes global object based on package.json and CSN object.
 * @param {Object} csn object
 * @returns {Object} An object containing global vaiables.
 */
const fInitializeGlobal = (csn) => {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    const appName = packageJson.name.replace(/\s/g, "-");

    const aModelKeys = Object.keys(csn.definitions);
    const aEvents = [];
    const aServices = [];
    const aODMEntity = [];

    const capNamespace = csn.namespace;
    // namespace variable value if present in cdsrc.json take it there or else from package.json
    const namespace = cds.env["ord"]?.namespace || `customer.${appName}`;
    const application_namespace = cds.env?.export?.asyncapi?.application_namespace;

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
        application_namespace
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
 * Gets list of services from CSN object
 * @param {Object} csn object
 * @returns {Array<object>} The API Resources array.
 */
const fGetAPIResources = (csn) => global.aServices.map((srv) => fCreateAPIResourceTemplate(srv, csn.definitions[srv])).filter((resource) => resource !== null && resource !== undefined);

/**
 * Retrieves the Event Resources
 * Gets list of event from CSN object
 * @param {Object} csn object
 * @returns {Array<object>} The Event Resources array.
 */
const fGetEventResources = (csn) => global.aEvents.map((srv) => fCreateEventResourceTemplate(srv, csn.definitions[srv]));

/**
 * Retrieves the Entity Types
 * Gets list of entity types from CSN object, Select entity having only ODM Anotation
 * @param {Object} csn object 
 * @returns {Array<object>} The Entity Resources array.
 */
const fGetEntityTypes = () => global.aODMEntity;

module.exports = (csn) => {
    try {
        global = fInitializeGlobal(csn)
        const data = global.namespace;
        const validateSystemNamespace = new RegExp("^" + global.application_namespace + "\.[^.]+\..+$");
        if (data === undefined && !validateSystemNamespace.test(data)) {
            return { status: "Error" }
        }
        const oReturn = {
            openResourceDiscovery: "1.9",
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