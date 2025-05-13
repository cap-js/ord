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
    _propagateORDVisibility,
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
    const packageJson = _loadPackageJson();
    const packageName = packageJson.name;
    const appName = _formatAppName(packageName);
    const lastUpdate = getRFC3339Date();

    const ordNamespace = _getORDNamespace(packageName);
    const eventApplicationNamespace = cds.env?.export?.asyncapi?.applicationNamespace;

    _validateNamespaces(ordNamespace, eventApplicationNamespace);

    const { serviceNames, apiEndpoints, eventNames, entityTypeTargets } = _triageCsnDefinitions(csn);

    return {
        env: cds.env["ord"],
        lastUpdate,
        appName,
        apiEndpoints: Array.from(apiEndpoints),
        eventNames,
        serviceNames,
        entityTypeTargets: _.uniqBy(entityTypeTargets, CONTENT_MERGE_KEY),
        ordNamespace,
        eventApplicationNamespace,
        packageName,
    };
};

function _loadPackageJson() {
    const packageJsonPath = path.join(cds.root, "package.json");
    if (!cds.utils.exists(packageJsonPath)) {
        throw new Error(`package.json not found in the project root directory`);
    }
    return require(packageJsonPath);
}

function _formatAppName(packageName) {
    return packageName.replace(/^[@]/, "").replace(/[@/]/g, "-");
}

function _getORDNamespace(packageName) {
    const vendorNamespace = "customer";
    return cds.env["ord"]?.namespace || `${vendorNamespace}.${packageName.replace(/[^a-zA-Z0-9]/g, "")}`;
}

function _validateNamespaces(ordNamespace, eventApplicationNamespace) {
    if (eventApplicationNamespace && ordNamespace !== eventApplicationNamespace) {
        Logger.warn("ORD and AsyncAPI namespaces should be the same.");
    }
}

function _triageCsnDefinitions(csn) {
    const pendingServiceNames = [];
    const apiEndpoints = new Set();
    const pendingEventNames = [];
    const entityTypeTargets = [];

    for (const definitionKey of Object.keys(csn.definitions)) {
        const definitionObj = csn.definitions[definitionKey];
        switch (definitionObj.kind) {
            case CDS_ELEMENT_KIND.service: {
                const serviceName = _handleService(definitionKey, definitionObj);
                if (serviceName) pendingServiceNames.push(serviceName);
                break;
            }
            case CDS_ELEMENT_KIND.entity: {
                const result = _handleEntity(definitionKey, definitionObj);
                if (result) {
                    if (result.apiEndpoint) apiEndpoints.add(result.apiEndpoint);
                    if (result.entityTypeTarget) entityTypeTargets.push(result.entityTypeTarget);
                }
                break;
            }
            case CDS_ELEMENT_KIND.event: {
                const event = _handleEvent(definitionKey);
                if (event) pendingEventNames.push(event);
                break;
            }
            case CDS_ELEMENT_KIND.action:
            case CDS_ELEMENT_KIND.function: {
                const apiEndpoint = _handleActionOrFunction(definitionKey);
                if (apiEndpoint) apiEndpoints.add(apiEndpoint);
                break;
            }
        }
    }

    return {
        serviceNames: pendingServiceNames,
        apiEndpoints: Array.from(apiEndpoints),
        eventNames: pendingEventNames,
        entityTypeTargets,
    };
}

function _handleService(key, keyDefinition) {
    if (!keyDefinition["@cds.external"]) {
        return key;
    }
    return null;
}

function _handleEntity(key, keyDefinition) {
    if (!key.includes(".texts")) {
        const apiEndpoint = key;
        const entityTypeTarget =
            keyDefinition[ORD_ODM_ENTITY_NAME_ANNOTATION] || keyDefinition[ENTITY_RELATIONSHIP_ANNOTATION]
                ? createEntityTypeMappingsItemTemplate(keyDefinition)
                : null;
        return { apiEndpoint, entityTypeTarget };
    }
    return null;
}

function _handleEvent(key) {
    return key;
}

function _handleActionOrFunction(key) {
    return key;
}

const _getPolicyLevels = (appConfig) => appConfig.env?.policyLevels || defaults.policyLevels;

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
    return appConfig.eventNames.flatMap((eventName) =>
        createEventResourceTemplate(eventName, csn.definitions[eventName], appConfig, packageIds, accessStrategies),
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

    ordDocument.packages = _getPackages(ordDocument.policyLevels, appConfig);

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
    const linkedCsn = _propagateORDVisibility(cds.linked(csn));
    const appConfig = initializeAppConfig(linkedCsn);
    const accessStrategies = getAuthConfig().accessStrategies;

    let ordDocument = createDefaultORDDocument(linkedCsn, appConfig);
    const packageIds = extractPackageIds(ordDocument);
    const entityTypes = _getEntityTypes(appConfig, packageIds);

    if (entityTypes.length) {
        ordDocument.entityTypes = entityTypes;
    }

    if (appConfig.serviceNames.length) {
        const apiResources = _getAPIResources(linkedCsn, appConfig, packageIds, accessStrategies);
        if (apiResources.length) {
            ordDocument.apiResources = apiResources;
        }
    }
    if (appConfig.eventNames.length) {
        const eventResources = _getEventResources(linkedCsn, appConfig, packageIds, accessStrategies);
        if (eventResources.length) {
            ordDocument.eventResources = eventResources;
        }
    }
    ordDocument = extendCustomORDContentIfExists(appConfig, ordDocument);
    ordDocument.packages = _filterUnusedPackages(ordDocument);

    return ordDocument;
};
