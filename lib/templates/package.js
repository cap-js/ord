const _ = require("lodash");

const { prune } = require("../common/utils");
const { createProducts } = require("./product");
const { ORD_RESOURCE_TYPE, RESOURCE_VISIBILITY } = require("../constants");

const RESOLVERS = Object.freeze({
    title: (appConfig) => {
        return appConfig?.env?.packages?.[0]?.title ?? appConfig.appName.replace(/[^a-zA-Z0-9]/g, " ").trim();
    },
    vendor: (appConfig) => {
        return appConfig?.env?.packages?.[0]?.vendor ?? "customer:vendor:Customer:";
    },
    version: (appConfig) => {
        return appConfig?.env?.packages?.[0]?.version ?? "1.0.0";
    },
    partOfProducts: (appConfig, products) => {
        return appConfig?.env?.packages?.[0]?.partOfProducts ?? products;
    },
    description: (appConfig, label, visibility) => {
        return (
            appConfig?.env?.packages?.[0]?.description ??
            `This package contains ${visibility} ${label} for ${RESOLVERS.title(appConfig)}.`
        );
    },
    shortDescription: (appConfig, label, visibility) => {
        return appConfig?.env?.packages?.[0]?.shortDescription ?? `Package containing ${visibility} ${label}`;
    },
    ordId: (appConfig, label, visibility, resourceType) => {
        const tag = !resourceType ? "" : `-${resourceType}`;
        const technicalName = appConfig.appName.replace(/[^a-zA-Z0-9]/g, "");
        const suffix = visibility === RESOURCE_VISIBILITY.public ? "" : `-${visibility}`;

        return (
            appConfig?.env?.packages?.[0]?.ordId ??
            `${appConfig.ordNamespace}:package:${technicalName}${tag}${suffix}:v1`
        );
    },
});

function createPackage(appConfig, { label, visibility, products, resourceType }) {
    return prune({
        title: RESOLVERS.title(appConfig),
        vendor: RESOLVERS.vendor(appConfig),
        version: RESOLVERS.version(appConfig),
        partOfProducts: RESOLVERS.partOfProducts(appConfig, products),
        description: RESOLVERS.description(appConfig, label, visibility),
        ordId: RESOLVERS.ordId(appConfig, label, visibility, resourceType),
        shortDescription: RESOLVERS.shortDescription(appConfig, label, visibility),

        ..._.omit(appConfig?.env?.packages?.[0], Object.keys(RESOLVERS)),
    });
}

function createPackages(appConfig) {
    const products = appConfig.existingProductORDId
        ? [appConfig.existingProductORDId]
        : createProducts(appConfig).map((p) => p.ordId);
    const visibilities = !appConfig.hasSAPPolicyLevel
        ? [RESOURCE_VISIBILITY.public]
        : Object.values(RESOURCE_VISIBILITY);
    const packageTypes = !appConfig.hasSAPPolicyLevel
        ? [{ label: "General" }]
        : [
              { label: "APIs", resourceType: ORD_RESOURCE_TYPE.api },
              { label: "Events", resourceType: ORD_RESOURCE_TYPE.event },
              { label: "Entity Types", resourceType: ORD_RESOURCE_TYPE.entityType },
              { label: "Data Products", resourceType: ORD_RESOURCE_TYPE.dataProduct },
              { label: "Integration Dependencies", resourceType: ORD_RESOURCE_TYPE.integrationDependency },
          ];

    return packageTypes.flatMap(({ label, resourceType }) =>
        visibilities.map((visibility) =>
            createPackage(appConfig, {
                label,
                visibility,
                products,
                resourceType,
            }),
        ),
    );
}

module.exports = {
    createPackages,
    createPackage,
    RESOLVERS,
};
