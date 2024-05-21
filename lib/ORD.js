const fs = require("fs");
const path = require("path");
const defaults = require("./defaults")
const {
    fCreateGroupsTemplate,
    fCreateAPIResourceTemplate,
    fCreateEventResourceTemplate,
    fCreateEntityTypeTemplate,
    fCreateIntegrationDependencyTemplate
} = require('./templates');
const { Console } = require("console");
// let global = {}

/**
 * Initializes global object based on package.json and CDS runtime object.
 * @returns {Object} An object containing global variables.
 */
const fInitializeGlobal = () => {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    const appName = packageJson.name.replace(/[-\/\\^$@*+?.()|[\]{}]/g, '_');

    const aModel = Object.keys(cds.model.definitions)

    const cap_namespace = cds.model.namespace

    const fGetEntityDefinition = (key) => cds.model.definitions[key];

    const fEventFilter = (key) => fGetEntityDefinition(key).kind === "event";
    const fServicesFilter = (srv) => srv.definition && srv.definition.kind === "service" && !srv.definition['@cds.external'];
    const fODMEntityFilter = (key) => {
        const oEntity = fGetEntityDefinition(key);
        return oEntity.kind === "entity"
            && key.includes(cap_namespace)
            && !key.includes(".texts")
            && oEntity["@ODM.entityName"]
    }

    const aEvents = aModel.filter((key) => fEventFilter(key));
    const aServices = Object.values(cds.services).filter((srv) => fServicesFilter(srv));
    const aODMEntity = aModel.filter((key) => fODMEntityFilter(key)).map((entity) => fCreateEntityTypeTemplate(entity));

    // namespace variable value if present in cdsrc.json take it there or else from package.json
    let namespace = cds.env["ord"]?.namespace || `customer.${appName}`;

    return {
        env: cds.env["ord"],
        cap_namespace,
        appName,
        aEvents,
        aServices,
        aODMEntity,
        namespace,
        application_namespace : cds.env?.export?.asyncapi?.application_namespace
    }
}

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
 * @returns {Array<object>} The groups array.
 */
const fGetGroups = () => {
    return global.aServices
        .map((srv) => fCreateGroupsTemplate(srv.definition.name))
        .filter((resource) => resource !== null && resource !== undefined);
};

/**
 * Retrieves the packages.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {Array<object>} The packages array.
 */
const fGetPackages = () => global.env?.packages || (global.aEvents.length) ? defaults.packages(global.appName) : defaults.packages(global.appName).slice(0, 1)

/**
 * Retrieves the consumption bundles.
 * Hierarchy to check data: cdsrc.json > defaults
 * @returns {Array<object>} The consumption bundles array.
 */
const fGetConsumptionBundles = () => global.env?.consumptionBundles || defaults.consumptionBundles;

/**
 * Retrieves the API Resources
 * Gets list of services from CDS runtime object
 * @returns {Array<object>} The API Resources array.
 */
const fGetAPIResources = () => {
    return global.aServices
        .map((srv) => fCreateAPIResourceTemplate(srv.definition.name))
        .filter((resource) => resource !== null && resource !== undefined);
};

/**
 * Retrieves the Event Resources
 * Gets list of event from CDS runtime object
 * @returns {Array<object>} The Event Resources array.
 */
const fGetEventResources = () => global.aEvents.map((srv) => fCreateEventResourceTemplate(srv));

/**
 * Retrieves the Entity Types
 * Gets list of entity types from CDS runtime object, Select entity having only ODM Annotation 
 * @returns {Array<object>} The Entity Resources array.
 */
const fGetEntityTypes = () => global.aODMEntity;

module.exports = () => {
    global = fInitializeGlobal()
    const data = global.namespace;
    const validateSystemNamespace = new RegExp("^" + global.application_namespace + "\.[^.]+\..+$");
    if (data === undefined && !validateSystemNamespace.test(data)) {
        let error = new Error(`Namespace is not defined in cdsrc.json or it is not in the format of ${global.application_namespace}.<appName>.<service>`);
        console.error('Namespace error:', error.message);
        throw error;
    }
    const oReturn = {
        openResourceDiscovery: "1.6",
        policyLevel: fGetPolicyLevel(),
        description: fGetDescription(),
        products: fGetProducts(),
        groups: fGetGroups(),
        packages: fGetPackages(),
        consumptionBundles: fGetConsumptionBundles(),
        apiResources: fGetAPIResources(),
        eventResources: fGetEventResources(),
        entityTypes: fGetEntityTypes()
    };
    return oReturn;
}
