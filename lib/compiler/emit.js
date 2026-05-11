const _ = require("lodash");
const defaults = require("../defaults");
const { compareAndHandleCustomORDContentWithExistingContent } = require("../extend-ord-with-custom");

function emit(ordDocument) {
    const { config, resolved, customOrd, extensions } = ordDocument;

    let document = {
        $schema: defaults.$schema,
        openResourceDiscovery: config.env?.openResourceDiscovery || defaults.openResourceDiscovery,
        policyLevels: config.policyLevels,
        description: config.env?.description || defaults.description,
        consumptionBundles: resolved.consumptionBundles,
    };

    if (config.env?.existingProductORDId) {
        config.existingProductORDId = config.env.existingProductORDId;
    } else {
        document.products = [resolved.products[0]];
    }

    document.packages = resolved.packages;

    if (resolved.groups.length) {
        document.groups = resolved.groups;
    }
    if (resolved.entityTypes.length) {
        document.entityTypes = resolved.entityTypes;
    }
    if (resolved.apiResources.length) {
        document.apiResources = resolved.apiResources;
    }
    if (resolved.eventResources.length) {
        document.eventResources = resolved.eventResources;
    }
    if (resolved.integrationDependencies.length) {
        document.integrationDependencies = resolved.integrationDependencies;
    }

    // Apply custom.ord.json and extensions
    [...(extensions || []), customOrd].filter(Boolean).forEach((extension) => {
        document = compareAndHandleCustomORDContentWithExistingContent(document, extension);
    });

    document.packages = _filterUnusedPackages(document);

    return document;
}

function _filterUnusedPackages(document) {
    if (!document.packages?.length) return [];

    const usedPackageIds = new Set();
    document.apiResources?.forEach((api) => usedPackageIds.add(api.partOfPackage));
    document.eventResources?.forEach((event) => usedPackageIds.add(event.partOfPackage));
    document.dataProducts?.forEach((dp) => usedPackageIds.add(dp.partOfPackage));
    document.integrationDependencies?.forEach((dep) => usedPackageIds.add(dep.partOfPackage));
    document.entityTypes?.forEach((et) => {
        if (et?.partOfPackage) usedPackageIds.add(et.partOfPackage);
    });

    return document.packages.filter((pkg) => usedPackageIds.has(pkg.ordId));
}

module.exports = { emit };
