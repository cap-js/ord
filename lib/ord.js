const _ = require("lodash");
const cds = require("@sap/cds");

const Logger = require("./logger");
const defaults = require("./defaults");
const { createAuthConfig } = require("./auth/authentication");
const Configuration = require("./configuration");
const { getIntegrationDependencies } = require("./integration-dependency");
const {
    getCustomORDContent,
    compareAndHandleCustomORDContentWithExistingContent,
} = require("./extend-ord-with-custom");
const {
    createAPIResourceTemplate,
    createEntityTypeTemplate,
    createEventResourceTemplate,
    createGroupsTemplateForService,
    _propagateORDVisibility,
} = require("./templates");

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

const _createDefaultORDDocument = (linkedCsn, appConfig, authConfig) => {
    const products = _getProducts(appConfig);
    const packages = defaults.packages(appConfig, products);
    const packageIds = packages?.map((pkg) => pkg.ordId) || [];
    const entityTypes = _getEntityTypes(appConfig, packageIds);
    const integrationDependencies = getIntegrationDependencies(linkedCsn, appConfig, packageIds);
    const apiResources = _getAPIResources(linkedCsn, appConfig, packageIds, authConfig.accessStrategies);
    const eventResources = _getEventResources(linkedCsn, appConfig, packageIds, authConfig.accessStrategies);

    return {
        // Unconditionally added top-level properties
        $schema: "https://open-resource-discovery.github.io/specification/spec-v1/interfaces/Document.schema.json",
        policyLevels: appConfig.policyLevels,
        packages: packages,
        description: appConfig.env?.description || defaults.description,
        openResourceDiscovery: appConfig.env?.openResourceDiscovery || defaults.openResourceDiscovery,

        // Conditionally added top-level properties
        ...(!entityTypes.length ? {} : { entityTypes: entityTypes }),
        ...(!apiResources.length ? {} : { apiResources: apiResources }),
        ...(!eventResources.length ? {} : { eventResources: eventResources }),
        ...(appConfig.existingProductORDId ? {} : { products: [products[0]] }),
        ...(!appConfig.serviceNames.length ? {} : { groups: _getGroups(linkedCsn, appConfig) }),
        ...(!integrationDependencies.length ? {} : { integrationDependencies: integrationDependencies }),
        ...(!appConfig.env?.consumptionBundles?.length ? {} : { consumptionBundles: appConfig.env.consumptionBundles }),
    };
};

const _filterUnusedPackages = (ordDocument) => {
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
};

const _getEntityTypes = (appConfig, packageIds) => {
    return appConfig.entityTypeTargets.flatMap((entity) => createEntityTypeTemplate(appConfig, packageIds, entity));
};

const _createAuthConfig = () => {
    const authConfig = createAuthConfig();

    // Create auth config and fail-closed on configuration errors
    if (authConfig.error) {
        throw new Error(`Authentication configuration error: ${authConfig.error}`);
    }

    return authConfig;
};

module.exports = (csn, extensions = []) => {
    const authConfig = _createAuthConfig();
    const linkedCsn = _propagateORDVisibility(cds.linked(csn));
    const appConfig = new Configuration(linkedCsn);
    const ordDocument = [...(extensions || []), getCustomORDContent(appConfig)]
        .filter((extension) => !!extension)
        .reduce(
            (document, extension) => compareAndHandleCustomORDContentWithExistingContent(document, extension),
            _createDefaultORDDocument(linkedCsn, appConfig, authConfig),
        );

    return Object.assign(ordDocument, { packages: _filterUnusedPackages(ordDocument) });
};
