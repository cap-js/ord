const _ = require("lodash");

const Logger = require("../logger");

function createProduct(appConfig) {
    let overrides = appConfig?.env?.products?.[0] ?? {};
    const name = appConfig.packageName.replace(/[^a-zA-Z0-9]/g, " ").trim();

    if (overrides?.ordId?.toLowerCase().startsWith("sap")) {
        overrides = {}; // disable overrides, misconfiguration detected
        Logger.error(
            "Detected sap product ordId, which should not be defined for custom products, use default value instead. Please check ORD global registry.",
        );
    }

    return {
        title: name,
        vendor: "customer:vendor:Customer:",
        shortDescription: `Short description of ${name}`,
        ordId: `customer:product:${name.split(" ").join(".")}:`,
        ...overrides,
    };
}

function createProducts(appConfig) {
    return appConfig.existingProductORDId ? [] : [createProduct(appConfig)];
}

module.exports = {
    createProducts, // TODO - add tests
    createProduct, // TODO - add tests
};
