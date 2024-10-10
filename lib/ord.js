const path = require("path");
const cds = require("@sap/cds");
const { exists } = cds.utils;
const defaults = require("./defaults");
const {
    createAPIResourceTemplate,
    createEventResourceTemplate,
    createGroupsTemplateForService,
    createEntityTypeTemplate
} = require('./templates');
const { extendCustomORDContentIfExists } = require('./extendOrdWithCustom');

const logger = cds.log('ord-plugin');

const initializeAppConfig = (csn) => {
    let packagejsonPath = path.join(cds.root, 'package.json')
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

    // namespace variable value if present in cdsrc.json take it there or else from package.json
    //if cdsrc.json does not have applicationNamespace, then use just the namespace
    const vendorNamespace = "customer";
    const ordNamespace =
        cds.env["ord"]?.namespace ||
        `${vendorNamespace}.${packageName.replace(/[^a-zA-Z0-9]/g, "")}`;
    const eventApplicationNamespace =
        cds.env?.export?.asyncapi?.applicationNamespace;

    if (
        eventApplicationNamespace &&
        ordNamespace !== eventApplicationNamespace
    ) {
        console.warn("ORD and AsyncAPI namespaces should be the same.");
    }

    const fEventFilter = (keyDefinition) => keyDefinition.kind === "event";
    const fServicesFilter = (keyDefinition) =>
        keyDefinition.kind === "service" && !keyDefinition["@cds.external"];
    const fODMEntityFilter = (key, keyDefinition) => {
        return (
            keyDefinition.kind === "entity" &&
            !key.includes(".texts") &&
            keyDefinition["@ODM.entityName"]
        );
    };

    aModelKeys.forEach((key) => {
        const keyDefinition = csn.definitions[key];
        if (fServicesFilter(keyDefinition)) {
            aServices.push(key);
        } else if (fODMEntityFilter(key, keyDefinition)) {
            aODMEntity.push(createEntityTypeTemplate(keyDefinition));
        } else if (fEventFilter(keyDefinition)) {
            aEvents.push(key);
        }
    });

    return {
        env: cds.env["ord"],
        appName,
        aEvents,
        aServices,
        aODMEntity,
        ordNamespace,
        eventApplicationNamespace,
        packageName,
    };
};

const getPolicyLevel = (appConfig) =>
    appConfig.env?.policyLevel || defaults.policyLevel;

const getDescription = (appConfig) =>
    appConfig.env?.description || defaults.description;

const getProducts = (appConfig) =>
    appConfig.env?.products || defaults.products(appConfig.packageName);

const getGroups = (csn, appConfig) => {
    return appConfig.aServices
        .map((srv) =>
            createGroupsTemplateForService(srv, csn.definitions[srv], appConfig)
        )
        .filter((resource) => resource !== null && resource !== undefined);
};

const getPackages = (policyLevel, appConfig) =>
    appConfig.env?.packages || appConfig.aEvents.length
        ? defaults.packages(appConfig.appName, policyLevel, appConfig.ordNamespace)
        : defaults
            .packages(appConfig.appName, policyLevel, appConfig.ordNamespace)
            .slice(0, 1);

const getAPIResources = (csn, appConfig, packageIds) => {
    const apiResources = [];
    appConfig.aServices.forEach((srv) => {
        createAPIResourceTemplate(
            srv,
            csn.definitions[srv],
            appConfig,
            packageIds
        )?.forEach((resource) => {
            if (resource !== null && resource !== undefined) {
                apiResources.push(resource);
            }
        });
    });
    return apiResources;
};

const getEventResources = (csn, appConfig, packageIds) => {
    if (appConfig.aEvents.length === 0) return [];

    const services = [];
    for (const serviceName of appConfig.aServices) {
        const hasEvents = appConfig.aEvents.find((eventName) =>
            eventName.startsWith(serviceName)
        );
        if (hasEvents) {
            services.push(serviceName);
        }
    }

    return services.map((serviceName) =>
        createEventResourceTemplate(
            serviceName,
            csn.definitions[serviceName],
            appConfig,
            packageIds
        )
    );
};

module.exports = (csn) => {
    const linkedCsn = cds.linked(csn);
    const appConfig = initializeAppConfig(linkedCsn);
    const validateSystemNamespace = new RegExp(
        `^${appConfig.eventApplicationNamespace}\\.[^.]+\\..+$`
    );
    if (
        appConfig.ordNamespace === undefined &&
        !validateSystemNamespace.test(appConfig.ordNamespace)
    ) {
        let error = new Error(
            `Namespace is not defined in cdsrc.json or it is not in the format of ${appConfig.eventApplicationNamespace}.<appName>.<service>`
        );
        console.error("Namespace error:", error.message);
        throw error;
    }

    let ordDocument = {
        $schema:
            "https://sap.github.io/open-resource-discovery/spec-v1/interfaces/Document.schema.json",
        openResourceDiscovery: "1.9",
        policyLevel: getPolicyLevel(appConfig),
        description: getDescription(appConfig),
        products: getProducts(appConfig),
        groups: getGroups(linkedCsn, appConfig),
    };
    if (
        getAPIResources(linkedCsn, appConfig).length > 0 &&
        getEventResources(linkedCsn, appConfig).length > 0
    ) {
        ordDocument.packages = getPackages(ordDocument.policyLevel, appConfig);
    }

    // check if oReturn.packages is defined and extract the ordId from the packages and store in a set
    let packageIds = new Set();
    if (ordDocument.packages) {
        ordDocument.packages.forEach((pkg) => {
            packageIds.add(pkg.ordId);
        });
    }
    ordDocument = {
        ...ordDocument,
        apiResources: getAPIResources(linkedCsn, appConfig, packageIds),
    };
    if (getEventResources(linkedCsn, appConfig, packageIds).length > 0) {
        ordDocument.eventResources = getEventResources(
            linkedCsn,
            appConfig,
            packageIds
        );
    }

    ordDocument = extendCustomORDContentIfExists(appConfig, ordDocument, logger);

    return ordDocument;
};
