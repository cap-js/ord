const path = require("path");
const cds = require("@sap/cds");
const { exists } = cds.utils;
const _ = require("lodash");
const defaults = require("./defaults");
const {
    createAPIResourceTemplate,
    createEventResourceTemplate,
    createGroupsTemplateForService,
    createEntityTypeTemplate
} = require('./templates');
const { extendCustomORDContentIfExists } = require('./extendOrdWithCustom');
const { ORD_RESOURCE_TYPE } = require('./constants');

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
    const modelKeys = Object.keys(csn.definitions);
    const events = [];
    const serviceNames = [];
    let odmEntity = [];

    // namespace variable value if present in cdsrc.json take it there or else from package.json
    //if cdsrc.json does not have applicationNamespace, then use just the namespace
    const vendorNamespace = "customer";
    const ordNamespace = cds.env["ord"]?.namespace || `${vendorNamespace}.${packageName.replace(/[^a-zA-Z0-9]/g, "")}`;
    const eventApplicationNamespace = cds.env?.export?.asyncapi?.applicationNamespace;

    if (eventApplicationNamespace && ordNamespace !== eventApplicationNamespace) {
        console.warn("ORD and AsyncAPI namespaces should be the same.");
    }

    for (const key of modelKeys) {
        const keyDefinition = csn.definitions[key];
        switch (keyDefinition.kind) {
            case ORD_RESOURCE_TYPE.service:
                if (!keyDefinition["@cds.external"]) {
                    serviceNames.push(key);
                }
                break;
            // TODO: should be rewritten
            case ORD_RESOURCE_TYPE.entity:
                if (!key.includes(".texts") && keyDefinition["@ODM.entityName"]) {
                    odmEntity.push(createEntityTypeTemplate(keyDefinition));
                }
                break;
            case ORD_RESOURCE_TYPE.event:
                events.push(key);
                break;
        }
    }

    odmEntity = _.uniqBy(odmEntity, "ordId");

    return {
        env: cds.env["ord"],
        appName,
        events,
        serviceNames,
        odmEntity,
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
    return appConfig.serviceNames
        .flatMap((serviceName) => createAPIResourceTemplate(serviceName, csn.definitions[serviceName], appConfig, packageIds) || [])
        .filter((resource) => !!resource);
};

const _getEventResources = (csn, appConfig, packageIds) => {
    if (appConfig.events.length === 0) return [];
    return appConfig.serviceNames
        .filter((serviceName) => appConfig.events.some((eventName) => eventName.startsWith(serviceName)))
        .flatMap((serviceName) => createEventResourceTemplate(serviceName, csn.definitions[serviceName], appConfig, packageIds) || []);
};

function validateNamespace(appConfig) {
    const validateSystemNamespace = new RegExp(`^${appConfig.eventApplicationNamespace}\\.[^.]+\\..+$`);
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
}

function createDefaultORDDocument(linkedCsn, appConfig) {
    let ordDocument = {
        $schema: "https://sap.github.io/open-resource-discovery/spec-v1/interfaces/Document.schema.json",
        openResourceDiscovery: "1.9",
        policyLevel: _getPolicyLevel(appConfig),
        description: _getDescription(appConfig),
        products: _getProducts(appConfig),
        groups: _getGroups(linkedCsn, appConfig),
    };

    if (_getAPIResources(linkedCsn, appConfig).length && _getEventResources(linkedCsn, appConfig).length) {
        ordDocument.packages = _getPackages(ordDocument.policyLevel, appConfig);
    }
    return ordDocument;
}

function extractPackageIds(ordDocument) {
    const packageIds = new Set();
    if (ordDocument.packages) {
        ordDocument.packages.map((pkg) => packageIds.add(pkg.ordId));
    }
    return packageIds;
}

module.exports = (csn) => {
    const linkedCsn = cds.linked(csn);
    const appConfig = initializeAppConfig(linkedCsn);
    validateNamespace(appConfig);

    let ordDocument = createDefaultORDDocument(linkedCsn, appConfig);
    const packageIds = extractPackageIds(ordDocument);
    // TODO: add testcase without apiResources or event, no empty package
    ordDocument.apiResources = _getAPIResources(linkedCsn, appConfig, packageIds);
    const eventResources = _getEventResources(linkedCsn, appConfig, packageIds);
    if (eventResources.length) {
        ordDocument.eventResources = eventResources;
    }

    ordDocument = extendCustomORDContentIfExists(appConfig, ordDocument, logger);

    return ordDocument;
};
