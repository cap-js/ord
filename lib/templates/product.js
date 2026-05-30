const _ = require("lodash");

const Logger = require("../logger");

const regexWithRemoval = (name) => {
    return name?.replace(/[^a-zA-Z0-9]/g, "");
};

const nameWithDot = (name) => {
    return regexWithRemoval(name.charAt(0)) + name.slice(1, name.length).replace(/[^a-zA-Z0-9]/g, ".");
};

const nameWithSpaces = (name) => {
    return regexWithRemoval(name.charAt(0)) + name.slice(1, name.length).replace(/[^a-zA-Z0-9]/g, " ");
};

function createProduct(appConfig) {
    return {
        vendor: "customer:vendor:Customer:",
        title: nameWithSpaces(appConfig.packageName),
        ordId: `customer:product:${nameWithDot(appConfig.packageName)}:`,
        shortDescription: `Short description of ${nameWithSpaces(appConfig.packageName)}`,
    };
}

const createProducts = (appConfig) => {
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
};

module.exports = {
    createProducts,
    createProduct,
};
