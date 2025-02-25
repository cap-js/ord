const {
    CDS_ELEMENT_KIND,
    CONTENT_MERGE_KEY,
    ENTITY_RELATIONSHIP_ANNOTATION,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    RESOURCE_VISIBILITY
} = require('./constants');
const {
    createAPIResourceTemplate,
    createEntityTypeTemplate,
    createEntityTypeMappingsItemTemplate,
    createEventResourceTemplate,
    createGroupsTemplateForService
} = require('./templates');
const { extendCustomORDContentIfExists } = require('./extendOrdWithCustom');
const { getRFC3339Date } = require('./date');
const { getAuthConfig } = require('./authentication');

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
    const apiEndpoints = new Set();
    const events = [];
    const entityTypeTargets = [];
    const serviceNames = [];
    const lastUpdate = getRFC3339Date();

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
                    apiEndpoints.add(key);
                    if (keyDefinition[ORD_ODM_ENTITY_NAME_ANNOTATION] || keyDefinition[ENTITY_RELATIONSHIP_ANNOTATION]) {
                        entityTypeTargets.push(createEntityTypeMappingsItemTemplate(keyDefinition));
                    }
                }
                break;
            case CDS_ELEMENT_KIND.event:
                events.push(key);
                break;
            case CDS_ELEMENT_KIND.action:
            case CDS_ELEMENT_KIND.function:
                apiEndpoints.add(key);
                break;
        }
    }

    return {
        env: cds.env["ord"],
        lastUpdate,
        appName,
        apiEndpoints: Array.from(apiEndpoints),
        events,
        serviceNames,
        entityTypeTargets: _.uniqBy(entityTypeTargets, CONTENT_MERGE_KEY),
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

const _getPackages = (policyLevel, appConfig) => {
    if (appConfig.env?.packages) {
        return appConfig.env.packages;
    }
    return _.uniqBy(defaults.packages(appConfig.appName, policyLevel, appConfig.ordNamespace), 'ordId');
};

const _getEntityTypes = (appConfig, packageIds) => {
    const internalEntityTypes = appConfig.entityTypeTargets.filter(m => m[ENTITY_RELATIONSHIP_ANNOTATION]);
    if (appConfig.entityTypeTargets?.length === 0 || internalEntityTypes.length === 0) return [];

    return internalEntityTypes.map(entity => createEntityTypeTemplate(appConfig, packageIds, entity));
};

const _getAPIResources = (csn, appConfig, packageIds, accessStrategies) => {
    return appConfig.serviceNames.flatMap((serviceName) => {
        const serviceDef = csn.definitions[serviceName];
        const visibility = serviceDef["@ORD.Extensions.visibility"] || RESOURCE_VISIBILITY.public;
        const isInternal = visibility === RESOURCE_VISIBILITY.internal;

        const packageId = _getPackageID(appConfig.ordNamespace, packageIds, "api", isInternal);

        return createAPIResourceTemplate(serviceName, serviceDef, appConfig, [packageId], accessStrategies);
    });
};


const _getEventResources = (csn, appConfig, packageIds, accessStrategies) => {
    return appConfig.serviceNames.flatMap((serviceName) => {
        const serviceDef = csn.definitions[serviceName];
        const visibility = serviceDef["@ORD.Extensions.visibility"] || RESOURCE_VISIBILITY.public;
        const isInternal = visibility === RESOURCE_VISIBILITY.internal;

        const packageId = _getPackageID(appConfig.ordNamespace, packageIds, "event", isInternal);

        return createEventResourceTemplate(serviceName, serviceDef, appConfig, [packageId], accessStrategies);
    });
};

function _getOpenResourceDiscovery(appConfig) {
    return appConfig.env?.openResourceDiscovery || defaults.openResourceDiscovery;
}

function _getConsumptionBundles(appConfig) {
    return appConfig.env?.consumptionBundles || defaults.consumptionBundles(appConfig);
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

function _getPackageID(namespace, packageIds = [], resourceType, isInternal = false) {
    if (!Array.isArray(packageIds) || packageIds.length === 0) {
        return `${namespace}:package:${resourceType}${isInternal ? "-internal" : ""}:v1`;
    }

    const searchKey = isInternal ? `-${resourceType}-internal` : `-${resourceType}`;
    return packageIds.find((id) => id.includes(searchKey)) || `${namespace}:package:${resourceType}${isInternal ? "-internal" : ""}:v1`;
}

function _filterUnusedPackages(ordDocument) {
    if (!ordDocument.packages || ordDocument.packages.length === 0) return [];

    const usedPackageIds = new Set();

    ordDocument.apiResources?.forEach(api => usedPackageIds.add(api.partOfPackage));
    ordDocument.eventResources?.forEach(event => usedPackageIds.add(event.partOfPackage));

    return ordDocument.packages.filter(pkg => usedPackageIds.has(pkg.ordId));
}

module.exports = (csn) => {
    const linkedCsn = cds.linked(csn);
    const appConfig = initializeAppConfig(linkedCsn);
    const accessStrategies = getAuthConfig().accessStrategies;

    let ordDocument = createDefaultORDDocument(linkedCsn, appConfig);
    const packageIds = extractPackageIds(ordDocument);
    const entityTypes = _getEntityTypes(appConfig, packageIds);
    if (entityTypes.length != 0) {
        ordDocument.entityTypes = entityTypes;
    }

    ordDocument.apiResources = _getAPIResources(linkedCsn, appConfig, packageIds, accessStrategies);
    ordDocument.eventResources = _getEventResources(linkedCsn, appConfig, packageIds, accessStrategies);
    ordDocument = extendCustomORDContentIfExists(appConfig, ordDocument);
    ordDocument.packages = _filterUnusedPackages(ordDocument);

    return ordDocument;
};
