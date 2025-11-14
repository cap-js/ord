const {
    BLOCKED_SERVICE_NAME,
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
    createMCPAPIResourceTemplate,
    _propagateORDVisibility,
} = require("./templates");
const { extendCustomORDContentIfExists } = require("./extendOrdWithCustom");
const { getRFC3339Date } = require("./date");
const { getAuthConfig } = require("./authentication");
const { isMCPPluginAvailable } = require("./metaData");

const { Logger } = require("./logger");
const _ = require("lodash");
const cds = require("@sap/cds");
const defaults = require("./defaults");
const path = require("path");

const _addMCPResourceIfAvailable = (apiResources, appConfig, packageIds, accessStrategies) => {
    if (isMCPPluginAvailable()) {
        try {
            const mcpResource = createMCPAPIResourceTemplate(appConfig, packageIds, accessStrategies);
            apiResources.push(mcpResource);
        } catch (error) {
            Logger.warn("Failed to create MCP API resource:", error.message);
        }
    }
};

const initializeAppConfig = (csn) => {
    const packageJson = _loadPackageJson();
    const packageName = packageJson.name;
    const appName = _formatAppName(packageName);
    const lastUpdate = getRFC3339Date();

    const ordNamespace = _getORDNamespace(packageName);
    const eventApplicationNamespace = cds.env?.export?.asyncapi?.applicationNamespace;

    _validateNamespaces(ordNamespace, eventApplicationNamespace);

    const { serviceNames, apiResourceNames, apiEndpoints, eventServiceNames, entityTypeTargets } =
        _triageCsnDefinitions(csn);

    return {
        env: cds.env["ord"],
        lastUpdate,
        appName,
        apiEndpoints: Array.from(apiEndpoints),
        eventServiceNames,
        serviceNames,
        apiResourceNames,
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
    const pendingApiResourceNames = [];
    const apiEndpoints = new Set();
    const pendingEventServiceNames = new Set();
    const entityTypeTargets = [];
    const serviceNames = Object.keys(csn.definitions).filter((key) => _isValidService(key, csn.definitions[key]));

    for (const definitionKey of Object.keys(csn.definitions)) {
        const definitionObj = csn.definitions[definitionKey];
        if (
            definitionKey.includes(BLOCKED_SERVICE_NAME.MTXServices) ||
            definitionKey.includes(BLOCKED_SERVICE_NAME.OpenResourceDiscoveryService)
        ) {
            Logger.warn("ORD service name", definitionKey, "is blocked.");
            continue;
        }
        switch (definitionObj.kind) {
            case CDS_ELEMENT_KIND.service: {
                const apiResourceName = _handleApiResource(definitionKey, definitionObj);
                if (apiResourceName) pendingApiResourceNames.push(apiResourceName);
                break;
            }
            case CDS_ELEMENT_KIND.entity: {
                const result = _handleEntity(definitionKey, definitionObj);
                if (result) {
                    if (result.apiEndpoint) apiEndpoints.add(result.apiEndpoint);
                    if (result.entityTypeTarget) entityTypeTargets.push(...result.entityTypeTarget);
                }
                break;
            }
            case CDS_ELEMENT_KIND.event: {
                const event = _handleEvent(serviceNames, definitionKey, definitionObj);
                if (event) pendingEventServiceNames.add(event);
                break;
            }
            case CDS_ELEMENT_KIND.action:
            case CDS_ELEMENT_KIND.function: {
                const apiEndpoint = _handleActionOrFunction(definitionKey, definitionObj);
                if (apiEndpoint) apiEndpoints.add(apiEndpoint);
                break;
            }
        }
    }

    return {
        serviceNames,
        apiResourceNames: pendingApiResourceNames,
        apiEndpoints: Array.from(apiEndpoints),
        eventServiceNames: [...pendingEventServiceNames],
        entityTypeTargets,
    };
}

function _handleApiResource(apiResourceName, serviceDefinition) {
    if (
        _shouldSkipIfServiceOnlyContainsEvents(serviceDefinition) ||
        !_isValidService(apiResourceName, serviceDefinition)
    ) {
        return null;
    }
    return apiResourceName;
}

function _shouldSkipIfServiceOnlyContainsEvents(serviceDefinition) {
    const isActionsNotContained = !serviceDefinition.actions || Object.keys(serviceDefinition.actions).length === 0;
    const isFunctionsNotContained =
        !serviceDefinition.functions || Object.keys(serviceDefinition.functions).length === 0;
    const isEntitiesNotContained = !serviceDefinition.entities || Object.keys(serviceDefinition.entities).length === 0;
    const isEventsContained = serviceDefinition.events && Object.keys(serviceDefinition.events).length > 0;
    if (isActionsNotContained && isFunctionsNotContained && isEntitiesNotContained && isEventsContained) {
        return true;
    }
    return false;
}

function _shouldNotSkipIfServiceProtocolIsNone(keyDefinition) {
    if (keyDefinition["_service"] && keyDefinition["_service"]["@protocol"] === "none") {
        return false;
    }
    return true;
}

function _isBlockedServiceName(key) {
    const blockedServices = [BLOCKED_SERVICE_NAME.MTXServices, BLOCKED_SERVICE_NAME.OpenResourceDiscoveryService];
    return blockedServices.some((blocked) => key.includes(blocked));
}

function _isValidService(key, definition) {
    const isExternalService = Object.keys(cds).includes("requires") ? Object.keys(cds.requires).includes(key) : false;

    return (
        definition.kind === CDS_ELEMENT_KIND.service &&
        !definition["@cds.external"] &&
        definition["@protocol"] !== "none" &&
        !isExternalService &&
        !_isBlockedServiceName(key)
    );
}

function _handleEntity(key, keyDefinition) {
    if (!key.includes(".texts") && _shouldNotSkipIfServiceProtocolIsNone(keyDefinition)) {
        const apiEndpoint = key;
        let entityTypeTarget = null;
        if (keyDefinition[ORD_ODM_ENTITY_NAME_ANNOTATION] || keyDefinition[ENTITY_RELATIONSHIP_ANNOTATION]) {
            const mapping = createEntityTypeMappingsItemTemplate(keyDefinition);
            if (Array.isArray(mapping)) entityTypeTarget = mapping;
            else if (mapping) entityTypeTarget = [mapping];
        }
        return { apiEndpoint, entityTypeTarget };
    }
    return null;
}

function _handleEvent(serviceNames, key, keyDefinition) {
    if (_shouldNotSkipIfServiceProtocolIsNone(keyDefinition)) {
        for (const serviceName of serviceNames) {
            if (key.startsWith(serviceName + ".")) {
                return serviceName;
            }
        }
    }
    return null;
}

function _handleActionOrFunction(key, keyDefinition) {
    if (_shouldNotSkipIfServiceProtocolIsNone(keyDefinition)) {
        return key;
    }
    return null;
}

const _getPolicyLevels = (appConfig) =>
    appConfig.env?.policyLevels ||
    (appConfig.env?.policyLevel && [appConfig.env?.policyLevel]) ||
    defaults.policyLevels;

const _getDescription = (appConfig) => appConfig.env?.description || defaults.description;

const _getGroups = (csn, appConfig) => {
    return appConfig.serviceNames
        .flatMap((serviceName) => createGroupsTemplateForService(serviceName, csn.definitions[serviceName], appConfig))
        .filter((resource) => !!resource);
};

const _getPackages = (appConfig) => {
    return defaults.packages(appConfig);
};

const _getEntityTypes = (appConfig, packageIds) => {
    if (!appConfig.entityTypeTargets?.length) return [];

    return appConfig.entityTypeTargets.flatMap((entity) => createEntityTypeTemplate(appConfig, packageIds, entity));
};

const _getAPIResources = (csn, appConfig, packageIds, accessStrategies) => {
    const apiResources = appConfig.apiResourceNames.flatMap((apiResourceName) =>
        createAPIResourceTemplate(
            apiResourceName,
            csn.definitions[apiResourceName],
            appConfig,
            packageIds,
            accessStrategies,
        ),
    );

    // Conditionally add MCP API resource if plugin is available
    _addMCPResourceIfAvailable(apiResources, appConfig, packageIds, accessStrategies);

    return apiResources;
};

const _getEventResources = (csn, appConfig, packageIds, accessStrategies) => {
    return appConfig.eventServiceNames.flatMap((serviceName) =>
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
    appConfig.policyLevels = _getPolicyLevels(appConfig);
    let ordDocument = {
        $schema: "https://open-resource-discovery.github.io/specification/spec-v1/interfaces/Document.schema.json",
        openResourceDiscovery: _getOpenResourceDiscovery(appConfig),
        policyLevels: appConfig.policyLevels,
        description: _getDescription(appConfig),
        consumptionBundles: _getConsumptionBundles(appConfig),
    };

    if (appConfig.serviceNames.length) {
        ordDocument.groups = _getGroups(linkedCsn, appConfig);
    }

    if (appConfig.env?.existingProductORDId) {
        appConfig.existingProductORDId = appConfig.env.existingProductORDId;
    } else {
        ordDocument.products = [_getProducts(appConfig)[0]];
    }

    ordDocument.packages = _getPackages(appConfig);

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

    if (appConfig.apiResourceNames.length) {
        const apiResources = _getAPIResources(linkedCsn, appConfig, packageIds, accessStrategies);
        if (apiResources.length) {
            ordDocument.apiResources = apiResources;
        }
    }
    if (appConfig.eventServiceNames.length) {
        const eventResources = _getEventResources(linkedCsn, appConfig, packageIds, accessStrategies);
        if (eventResources.length) {
            ordDocument.eventResources = eventResources;
        }
    }
    ordDocument = extendCustomORDContentIfExists(appConfig, ordDocument);
    ordDocument.packages = _filterUnusedPackages(ordDocument);

    return ordDocument;
};
