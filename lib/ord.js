const { CDS_ELEMENT_KIND } = require('./constants');
const {
    createAPIResourceTemplate,
    createEntityTypeMappingsItemTemplate,
    createEventResourceTemplate,
    createGroupsTemplateForService
} = require('./templates');
const { extendCustomORDContentIfExists } = require('./extendOrdWithCustom');
const { getRFC3339Date } = require('./date');
const { Logger } = require('./logger');
const _ = require("lodash");
const cds = require("@sap/cds");
const defaults = require("./defaults");
const path = require("path");

const initializeAppConfig = (csn) => {
    let packageJsonPath = path.join(cds.root, 'package.json')
    let packageJson;
    if (cds.utils.exists(packageJsonPath)) {
        packageJson = require(packageJsonPath);
    } else {
        throw new Error(`package.json not found in the project root directory`);
    }
    const packageName = packageJson.name;
    const appName = packageJson.name.replace(/^[@]/, "").replace(/[@/]/g, "-");
    const modelKeys = Object.keys(csn.definitions);
    const endpoints = new Set();
    const events = [];
    const serviceNames = [];
    const lastUpdate = getRFC3339Date();
    let odmEntities = [];

    const vendorNamespace = "customer";
    const ordNamespace = cds.env["ord"]?.namespace || `${vendorNamespace}.${packageName.replace(/[^a-zA-Z0-9]/g, "")}`;
    const eventApplicationNamespace = cds.env?.export?.asyncapi?.applicationNamespace;

    if (eventApplicationNamespace && ordNamespace !== eventApplicationNamespace) {
        Logger.warn('ORD and AsyncAPI namespaces should be the same.');
    }

    for (const key of modelKeys) {
        const keyDefinition = csn.definitions[key];
        switch (keyDefinition.kind) {
            case CDS_ELEMENT_KIND.service:
                if (!keyDefinition["@cds.external"]) {
                    serviceNames.push(key);
                }
                break;
            // TODO: should be rewritten
            case CDS_ELEMENT_KIND.entity:
                if (!key.includes(".texts")) {
                    endpoints.add(key);
                    if (keyDefinition["@ODM.entityName"]) {
                        odmEntities.push(createEntityTypeMappingsItemTemplate(keyDefinition));
                    }
                }
                break;
            case CDS_ELEMENT_KIND.event:
                events.push(key);
                break;
            case CDS_ELEMENT_KIND.action:
            case CDS_ELEMENT_KIND.function:
                endpoints.add(key);
                break;
        }
    }

    return {
        env: cds.env["ord"],
        lastUpdate,
        appName,
        endpoints: Array.from(endpoints),
        events,
        serviceNames,
        odmEntities: _.uniqBy(odmEntities, "ordId"),
        ordNamespace,
        eventApplicationNamespace,
        packageName,
    };
};

const _getPolicyLevel = (appConfig) =>
    appConfig.env?.policyLevel || defaults.policyLevel;

const _getDescription = (appConfig) =>
    appConfig.env?.description || defaults.description;

const _getProducts = (appConfig) =>
    appConfig.env?.products || defaults.products(appConfig.packageName);

const _getGroups = (csn, appConfig) => {
    return appConfig.serviceNames
        .flatMap((serviceName) => createGroupsTemplateForService(serviceName, csn.definitions[serviceName], appConfig))
        .filter((resource) => !!resource);
};

const _getPackages = (policyLevel, appConfig) =>
    appConfig.env?.packages || appConfig.events.length
        ? defaults.packages(appConfig.appName, policyLevel, appConfig.ordNamespace)
        : defaults
            .packages(appConfig.appName, policyLevel, appConfig.ordNamespace)
            .slice(0, 1);

const _getAPIResources = (csn, appConfig, packageIds) => {
    if (appConfig.endpoints.length === 0) return [];
    return appConfig.serviceNames
        .filter((serviceName) => appConfig.endpoints.some((endpoint) => endpoint.startsWith(serviceName)))
        .flatMap((serviceName) => createAPIResourceTemplate(serviceName, csn.definitions[serviceName], appConfig, packageIds))
};

const _getEventResources = (csn, appConfig, packageIds) => {
    if (appConfig.events.length === 0) return [];
    return appConfig.serviceNames
        .filter((serviceName) => appConfig.events.some((eventName) => eventName.startsWith(serviceName)))
        .flatMap((serviceName) => createEventResourceTemplate(serviceName, csn.definitions[serviceName], appConfig, packageIds));
};

function _getOpenResourceDiscovery(appConfig) {
    return appConfig.env?.openResourceDiscovery || defaults.openResourceDiscovery;
}

function _getConsumptionBundles(appConfig) {
    return appConfig.env?.consumptionBundles || defaults.consumptionBundles(appConfig);
}

function validateNamespace(appConfig) {
    const validateSystemNamespace = new RegExp(`^${appConfig.eventApplicationNamespace}\\.[^.]+\\..+$`);
    if (
        appConfig.ordNamespace === undefined &&
        !validateSystemNamespace.test(appConfig.ordNamespace)
    ) {
        let error = new Error(
            `Namespace is not defined in cdsrc.json or it is not in the format of ${appConfig.eventApplicationNamespace}.<appName>.<service>`
        );
        Logger.error('Namespace error:', error.message);
        throw error;
    }
}

function createDefaultORDDocument(linkedCsn, appConfig) {
    let ordDocument = {
        $schema: "https://sap.github.io/open-resource-discovery/spec-v1/interfaces/Document.schema.json",
        openResourceDiscovery: _getOpenResourceDiscovery(appConfig),
        policyLevel: _getPolicyLevel(appConfig),
        description: _getDescription(appConfig),
        products: _getProducts(appConfig),
        groups: _getGroups(linkedCsn, appConfig),
        consumptionBundles: _getConsumptionBundles(appConfig),
    };

    if (_getAPIResources(linkedCsn, appConfig).length && _getEventResources(linkedCsn, appConfig).length) {
        ordDocument.packages = _getPackages(ordDocument.policyLevel, appConfig);
    }
    return ordDocument;
}

function extractPackageIds(ordDocument) {
    const packageIds = [];
    if (ordDocument.packages) {
        ordDocument.packages.map((pkg) => packageIds.push(pkg.ordId));
    }
    return packageIds;
}

module.exports = (csn) => {
    const linkedCsn = cds.linked(csn);
    const appConfig = initializeAppConfig(linkedCsn);
    validateNamespace(appConfig);

    let ordDocument = createDefaultORDDocument(linkedCsn, appConfig);
    const packageIds = extractPackageIds(ordDocument);
    ordDocument.apiResources = _getAPIResources(linkedCsn, appConfig, packageIds);
    ordDocument.eventResources = _getEventResources(linkedCsn, appConfig, packageIds);
    ordDocument = extendCustomORDContentIfExists(appConfig, ordDocument);

    return ordDocument;
};
