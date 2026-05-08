const {
    createAPIResourceTemplate,
    createEntityTypeTemplate,
    createEventResourceTemplate,
    createGroupsTemplateForService,
    _propagateORDVisibility,
} = require("./templates");
const { getIntegrationDependencies } = require("./integration-dependency");
const {
    getCustomORDContent,
    compareAndHandleCustomORDContentWithExistingContent,
} = require("./extend-ord-with-custom");
const { createAuthConfig } = require("./auth/authentication");

const Logger = require("./logger");
const _ = require("lodash");
const cds = require("@sap/cds");
const defaults = require("./defaults");
const Configuration = require("./configuration");

const _getGroups = (csn, appConfig) => {
    return appConfig.serviceNames
        .flatMap((serviceName) => createGroupsTemplateForService(serviceName, csn.definitions[serviceName], appConfig))
        .filter((resource) => !!resource);
};

const _getAPIResources = (csn, appConfig, packageIds, accessStrategies) => {
    return appConfig.apiResourceNames.flatMap((apiResourceName) =>
        createAPIResourceTemplate(
            apiResourceName,
            csn.definitions[apiResourceName],
            appConfig,
            packageIds,
            accessStrategies,
        ),
    );
};

const _getEventResources = (csn, appConfig, packageIds, accessStrategies) => {
    return appConfig.eventServiceNames.flatMap((serviceName) =>
        createEventResourceTemplate(serviceName, csn.definitions[serviceName], appConfig, packageIds, accessStrategies),
    );
};

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
    return productsObj;
};

function createDefaultORDDocument(linkedCsn, appConfig) {
    const products = _getProducts(appConfig);

    return {
        $schema: "https://open-resource-discovery.github.io/specification/spec-v1/interfaces/Document.schema.json",
        policyLevels: appConfig.policyLevels,
        packages: defaults.packages(appConfig, products),
        description: appConfig.env?.description || defaults.description,
        openResourceDiscovery: appConfig.env?.openResourceDiscovery || defaults.openResourceDiscovery,
        consumptionBundles: appConfig.env?.consumptionBundles || defaults.consumptionBundles(appConfig),
        ...(appConfig.existingProductORDId ? {} : { products: [products[0]] }),
        ...(!appConfig.serviceNames.length ? {} : { groups: _getGroups(linkedCsn, appConfig) }),
    };
}

function extractPackageIds(ordDocument) {
    return ordDocument.packages?.map((pkg) => pkg.ordId) || [];
}

function _filterUnusedPackages(ordDocument) {
    if (!ordDocument.packages?.length) return [];

    const usedPackageIds = new Set();

    ordDocument.apiResources?.forEach((api) => usedPackageIds.add(api.partOfPackage));
    ordDocument.eventResources?.forEach((event) => usedPackageIds.add(event.partOfPackage));
    ordDocument.dataProducts?.forEach((dp) => usedPackageIds.add(dp.partOfPackage));
    ordDocument.integrationDependencies?.forEach((dep) => usedPackageIds.add(dep.partOfPackage));
    ordDocument.entityTypes?.forEach((et) => {
        if (et?.partOfPackage) {
            usedPackageIds.add(et.partOfPackage);
        }
    });

    return ordDocument.packages.filter((pkg) => usedPackageIds.has(pkg.ordId));
}

const _getEntityTypes = (appConfig, packageIds) => {
    if (!appConfig.entityTypeTargets?.length) return [];

    return appConfig.entityTypeTargets.flatMap((entity) => createEntityTypeTemplate(appConfig, packageIds, entity));
};

module.exports = (csn, extensions = []) => {
    const linkedCsn = _propagateORDVisibility(cds.linked(csn));
    const appConfig = new Configuration(linkedCsn);

    // Create auth config and fail-closed on configuration errors
    const authConfig = createAuthConfig();
    if (authConfig.error) {
        throw new Error(`Authentication configuration error: ${authConfig.error}`);
    }
    const accessStrategies = authConfig.accessStrategies;

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

    const integrationDependencies = getIntegrationDependencies(linkedCsn, appConfig, packageIds);
    if (integrationDependencies.length) {
        ordDocument.integrationDependencies = integrationDependencies;
    }

    [...(extensions || []), getCustomORDContent(appConfig)]
        .filter((extension) => !!extension)
        .forEach((extension) => {
            ordDocument = compareAndHandleCustomORDContentWithExistingContent(ordDocument, extension);
        });

    ordDocument.packages = _filterUnusedPackages(ordDocument);

    return ordDocument;
};
