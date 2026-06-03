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

function prune(document) {
    const usedPackageIds = new Set(
        document.packages?.length === 0
            ? []
            : [
                  ...(document.entityTypes?.map((et) => et.partOfPackage) ?? []),
                  ...(document.dataProducts?.map((dp) => dp.partOfPackage) ?? []),
                  ...(document.apiResources?.map((ar) => ar.partOfPackage) ?? []),
                  ...(document.eventResources?.map((er) => er.partOfPackage) ?? []),
                  ...(document.integrationDependencies?.map((id) => id.partOfPackage) ?? []),
              ],
    );
    const packages = document.packages?.filter((pkg) => usedPackageIds.has(pkg.ordId));

    return Object.fromEntries(
        Object.entries(Object.assign(document, { packages })) // remove unused packages
            .filter(([, value]) => value !== null && value !== undefined) // remove empty fields
            .filter(([, value]) => typeof value !== "object" || Object.keys(value).length > 0), // remove empty arrays
    );
}

function extend(extensions, document) {
    return extensions.reduce(
        (ord, extension) => compareAndHandleCustomORDContentWithExistingContent(ord, extension),
        document,
    );
}

module.exports = (csn, extensions) => {
    const appConfig = new Configuration(csn);

    return prune(
        extend(
            [...(extensions || []), getCustomORDContent(appConfig)].filter(Boolean), //
            {
                $schema: defaults.$schema,
                baseUrl: appConfig.env.baseUrl,
                groups: createGroups(appConfig),
                products: createProducts(appConfig),
                packages: createPackages(appConfig),
                policyLevels: appConfig.policyLevels,
                entityTypes: createEntityTypes(appConfig),
                apiResources: createAPIResources(appConfig),
                eventResources: createEventResources(appConfig),
                consumptionBundles: appConfig.env?.consumptionBundles,
                description: appConfig.env?.description ?? defaults.description,
                integrationDependencies: createIntegrationDependencies(appConfig),
                openResourceDiscovery: appConfig.env?.openResourceDiscovery ?? defaults.openResourceDiscovery,
            },
        ),
    );
};
