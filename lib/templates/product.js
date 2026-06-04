const _ = require("lodash");

const Logger = require("../logger");
const { prune } = require("../common/utils");

const RESOLVERS = Object.freeze({
    ordId: (appConfig, overrides) => {
        const name = appConfig.packageName
            .split(/[^a-zA-Z0-9]/)
            .filter(Boolean)
            .join(".");

        return overrides?.ordId ?? `customer:product:${name}:`;
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

function extractOverrides(appConfig) {
    if (appConfig?.env?.products?.[0]?.ordId?.toLowerCase().startsWith("sap")) {
        Logger.error(
            "Detected sap product ordId, which should not be defined for custom products, use default value instead. Please check ORD global registry.",
        );

        return {}; // disable overrides, misconfiguration detected
    }

    return appConfig?.env?.products?.[0] ?? {};
}

function createProduct(appConfig) {
    const overrides = extractOverrides(appConfig);

    return prune({
        ordId: RESOLVERS.ordId(appConfig, overrides),
        title: RESOLVERS.title(appConfig, overrides),
        vendor: RESOLVERS.vendor(appConfig, overrides),
        shortDescription: RESOLVERS.shortDescription(appConfig, overrides),

        ..._.omit(overrides, Object.keys(RESOLVERS)),
    });
}

function createProducts(appConfig) {
    return appConfig.existingProductORDId ? [] : [createProduct(appConfig)];
}

module.exports = {
    createProducts,
    createProduct,
    RESOLVERS,
};
