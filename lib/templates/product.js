const _ = require("lodash");

const Logger = require("../logger");

function createProduct(appConfig) {
    const name = appConfig.packageName.replace(/[^a-zA-Z0-9]/g, " ").trim();

    return {
        title: name,
        vendor: "customer:vendor:Customer:",
        shortDescription: `Short description of ${name}`,
        ordId: `customer:product:${name.split(" ").join(".")}:`,
    };
}

function createProducts(appConfig) {
    const products = [createProduct(appConfig)];

    if (appConfig.env?.products) {
        const customProducts = appConfig.env.products[0];
        if (customProducts?.ordId?.toLowerCase().startsWith("sap")) {
            Logger.error(
                "Detected sap product ordId, which should not be defined for custom products, use default value instead. Please check ord global registry.",
            );
        } else {
            _.assign(products[0], customProducts);
        }
    }

    return appConfig.existingProductORDId ? [] : products;
}

module.exports = {
    createProducts,
    createProduct,
};
