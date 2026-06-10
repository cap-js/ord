const _ = require("lodash");

const Logger = require("../logger");
const placeholders = require("../common/placeholders");

const RESOLVERS = Object.freeze({
    ordId: (appConfig, overrides) => {
        const name = appConfig.packageName
            .split(/[^a-zA-Z0-9]/)
            .filter(Boolean)
            .join(".");

        return (
            placeholders.replace(overrides?.ordId, { type: "product", namespace: appConfig.ordNamespace }) ??
            `customer:product:${name}:`
        );
    },
    title: (appConfig, overrides) => {
        return overrides?.title ?? appConfig.packageName.replace(/[^a-zA-Z0-9]/g, " ").trim();
    },
    vendor: (appConfig, overrides) => {
        return overrides?.vendor ?? "customer:vendor:Customer:";
    },
    shortDescription: (appConfig, overrides) => {
        return overrides?.shortDescription ?? `Short description of ${RESOLVERS.title(appConfig, overrides)}`;
    },
});

function createProduct(appConfig) {
    let overrides = appConfig?.env?.products?.[0] ?? {};

    if (overrides?.ordId?.toLowerCase().startsWith("sap")) {
        overrides = {}; // disable overrides, misconfiguration detected
        Logger.error(
            "Detected sap product ordId, which should not be defined for custom products, use default value instead. Please check ORD global registry.",
        );
    }

    return {
        title: RESOLVERS.title(appConfig, overrides),
        ordId: RESOLVERS.ordId(appConfig, overrides),
        vendor: RESOLVERS.vendor(appConfig, overrides),
        shortDescription: RESOLVERS.shortDescription(appConfig, overrides),

        ..._.omit(overrides, Object.keys(RESOLVERS)),
    };
}

function createProducts(appConfig) {
    return appConfig.existingProductORDId ? [] : [createProduct(appConfig)];
}

module.exports = {
    createProducts,
    createProduct,
    RESOLVERS,
};
