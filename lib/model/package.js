const _ = require("lodash");
const defaults = require("../defaults");
const Logger = require("../logger");
const { hasSAPPolicyLevel } = require("./entity-type");

function createProducts(config) {
    const products = defaults.products(config.packageName);
    if (config.env?.products) {
        const customProducts = config.env.products[0];
        if (customProducts?.ordId?.toLowerCase().startsWith("sap")) {
            Logger.error("Detected sap product ordId, which should not be defined for custom products.");
        } else {
            _.assign(products[0], customProducts);
        }
    }
    config.products = products;
    return products;
}

function createPackages(config, products) {
    const appConfig = {
        ...config,
        policyLevels: config.policyLevels,
        hasSAPPolicyLevel: hasSAPPolicyLevel(config.policyLevels),
        existingProductORDId: config.env?.existingProductORDId,
        products,
    };
    return defaults.packages(appConfig, products);
}

function createConsumptionBundles(config) {
    return config.env?.consumptionBundles || defaults.consumptionBundles(config);
}

module.exports = { createProducts, createPackages, createConsumptionBundles };
