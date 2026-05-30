const cds = require("@sap/cds");

const defaults = require("./defaults");
const Configuration = require("./configuration");
const { createGroups } = require("./templates/group");
const { createPackages } = require("./templates/package");
const { createProducts } = require("./templates/product");
const { createEntityTypes } = require("./templates/entity-type");
const { createAPIResources } = require("./templates/api-resource");
const { createEventResources } = require("./templates/event-resource");
const { createIntegrationDependencies } = require("./templates/integration-dependency");
const {
    getCustomORDContent,
    compareAndHandleCustomORDContentWithExistingContent,
} = require("./extend-ord-with-custom");

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

module.exports = (csn, extensions = []) => {
    const appConfig = new Configuration(cds.linked(csn));
    const ordDocument = [...(extensions || []), getCustomORDContent(appConfig)]
        .filter((extension) => !!extension)
        .reduce((document, extension) => compareAndHandleCustomORDContentWithExistingContent(document, extension), {
            $schema: defaults.$schema,
            groups: createGroups(appConfig),
            products: createProducts(appConfig),
            packages: createPackages(appConfig),
            policyLevels: appConfig.policyLevels,
            entityTypes: createEntityTypes(appConfig),
            apiResources: createAPIResources(appConfig),
            eventResources: createEventResources(appConfig),
            consumptionBundles: appConfig.env?.consumptionBundles ?? [],
            description: appConfig.env?.description ?? defaults.description,
            integrationDependencies: createIntegrationDependencies(appConfig),
            openResourceDiscovery: appConfig.env?.openResourceDiscovery || defaults.openResourceDiscovery,
        });

    return Object.fromEntries(
        Object.entries(Object.assign(ordDocument, { packages: _filterUnusedPackages(ordDocument) })) //
            .filter(([, value]) => value !== null && value !== undefined)
            .filter(([, value]) => typeof value !== "object" || Object.keys(value).length > 0),
    );
};
