const {
    CDS_ELEMENT_KIND,
    CONTENT_MERGE_KEY,
    ENTITY_RELATIONSHIP_ANNOTATION,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
} = require("./constants");
const {
    createAPIResourceTemplate,
    createEntityTypeTemplate,
    createEntityTypeMappingsItemTemplate,
    createEventResourceTemplate,
    createGroupsTemplateForService,
} = require("./templates");
const { extendCustomORDContentIfExists } = require("./extendOrdWithCustom");
const { getRFC3339Date } = require("./date");
const { getAuthConfig } = require("./authentication");

const { Logger } = require("./logger");
const _ = require("lodash");
const cds = require("@sap/cds");
const defaults = require("./defaults");
const path = require("path");

const initializeAppConfig = (csn) => {
    let packageJsonPath = path.join(cds.root, "package.json");
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
        Logger.warn("ORD and AsyncAPI namespaces should be the same.");
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
                    if (
                        keyDefinition[ORD_ODM_ENTITY_NAME_ANNOTATION] ||
                        keyDefinition[ENTITY_RELATIONSHIP_ANNOTATION]
                    ) {
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

const _getPolicyLevels = (
    appConfig) => appConfig.env?.policyLevels ||
    appConfig.env?.policyLevel && [appConfig.env?.policyLevel] ||
    defaults.policyLevels;

const _getDescription = (appConfig) => appConfig.env?.description || defaults.description;

const _getGroups = (csn, appConfig) => {
    return appConfig.serviceNames
        .flatMap((serviceName) => createGroupsTemplateForService(serviceName, csn.definitions[serviceName], appConfig))
        .filter((resource) => !!resource);
};

const _getPackages = (policyLevels, appConfig) => {
    return defaults.packages(appConfig, policyLevels);
};

const _getEntityTypes = (appConfig, packageIds) => {
    if (!appConfig.entityTypeTargets?.length) return [];

    return appConfig.entityTypeTargets.map((entity) => createEntityTypeTemplate(appConfig, packageIds, entity));
};

const _getAPIResources = (csn, appConfig, packageIds, accessStrategies) => {
    return appConfig.serviceNames.flatMap((serviceName) =>
        createAPIResourceTemplate(serviceName, csn.definitions[serviceName], appConfig, packageIds, accessStrategies),
    );
};

const _getEventResources = (csn, appConfig, packageIds, accessStrategies) => {
    return appConfig.serviceNames.flatMap((serviceName) =>
        createEventResourceTemplate(serviceName, csn.definitions[serviceName], appConfig, packageIds, accessStrategies),
    );
};

function _getOpenResourceDiscovery(appConfig) {
    return appConfig.env?.openResourceDiscovery || defaults.openResourceDiscovery;
}

function _getConsumptionBundles(appConfig) {
    return appConfig.env?.consumptionBundles || defaults.consumptionBundles(appConfig);
}

const _getProducts = (appConfig) => {
    const productsObj = defaults.products(appConfig.packageName);
    if (appConfig.env?.products) {
        const customProducts = appConfig.env.products[0];
        if (customProducts?.ordId?.toLowerCase().startsWith("sap")) {
            Logger.error(
                "Detected sap product ordId, which should not be defined for custom products, use default value instead. Please check ord global registry.",
            );
        } else {
            _.assign(productsObj[0], customProducts);
        }
    }
    appConfig.products = productsObj;
    return productsObj;
};

function createDefaultORDDocument(linkedCsn, appConfig) {
    let ordDocument = {
        $schema: "https://open-resource-discovery.github.io/specification/spec-v1/interfaces/Document.schema.json",
        openResourceDiscovery: _getOpenResourceDiscovery(appConfig),
        policyLevels: _getPolicyLevels(appConfig),
        description: _getDescription(appConfig),
        groups: _getGroups(linkedCsn, appConfig),
        consumptionBundles: _getConsumptionBundles(appConfig),
    };

    if (appConfig.env?.existingProductORDId) {
        appConfig.existingProductORDId = appConfig.env.existingProductORDId;
    } else {
        ordDocument.products = [_getProducts(appConfig)[0]];
    }

    const apiResources = _getAPIResources(linkedCsn, appConfig);
    const eventResources = _getEventResources(linkedCsn, appConfig);

    if (apiResources.length > 0 || eventResources.length > 0) {
        ordDocument.packages = _getPackages(ordDocument.policyLevels, appConfig);
    }

    return ordDocument;
}

function extractPackageIds(ordDocument) {
    return ordDocument.packages?.map((pkg) => pkg.ordId) || [];
}

function _filterUnusedPackages(ordDocument) {
    if (!ordDocument.packages?.length) return [];

    const usedPackageIds = new Set();

    ordDocument.apiResources?.forEach((api) => usedPackageIds?.add(api.partOfPackage));
    ordDocument.eventResources?.forEach((event) => usedPackageIds?.add(event.partOfPackage));
    ordDocument.dataProducts?.forEach((dp) => usedPackageIds?.add(dp.partOfPackage));
    ordDocument.entityTypes?.forEach((et) => {
        if (et && et.partOfPackage) {
            usedPackageIds.add(et.partOfPackage);
        }
    });

    const filteredPackages = ordDocument.packages.filter((pkg) => usedPackageIds.has(pkg.ordId));

    return filteredPackages;
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
