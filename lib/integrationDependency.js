const { EXTERNAL_DP_ORD_ID_ANNOTATION, ORD_RESOURCE_TYPE, RESOURCE_VISIBILITY } = require("./constants");
const { readORDExtensions, _getPackageID, parseDataProductOrdId, isExternalDataProduct } = require("./templates");

/**
 * Collects external Data Products from CSN definitions.
 * Groups resources by namespace.
 */
function collectExternalDataProducts(csn) {
    const dataProductsMap = new Map();

    for (const definition of Object.values(csn.definitions)) {
        if (!isExternalDataProduct(definition)) continue;

        const dpOrdId = definition[EXTERNAL_DP_ORD_ID_ANNOTATION];
        const { namespace, resourceType, version } = parseDataProductOrdId(dpOrdId);

        if (!dataProductsMap.has(namespace)) {
            dataProductsMap.set(namespace, {
                namespace,
                serviceDefinition: definition,
                apiResources: [],
                eventResources: [],
            });
        }

        const dp = dataProductsMap.get(namespace);
        const resource = {
            ordId: dpOrdId,
            minVersion: version.replace("v", "") + ".0.0",
        };

        if (resourceType === "apiResource") {
            dp.apiResources.push(resource);
        } else if (resourceType === "eventResource") {
            dp.eventResources.push(resource);
        }
    }

    return Array.from(dataProductsMap.values());
}

/**
 * Creates IntegrationDependency template for a Data Product.
 * Supports customization via @ORD.Extensions annotations.
 */
function createIntegrationDependencyTemplate(dataProduct, appConfig, packageIds) {
    const ordExtensions = readORDExtensions(dataProduct.serviceDefinition || {});
    const localId = dataProduct.namespace.replace(/[^a-zA-Z0-9]/g, "");
    const ordId = `${appConfig.ordNamespace}:integrationDependency:${dataProduct.namespace}:v1`;
    const packageId = _getPackageID(appConfig.ordNamespace, packageIds, ORD_RESOURCE_TYPE.integrationDependency, RESOURCE_VISIBILITY.public);

    const aspects = [];

    if (dataProduct.apiResources.length > 0) {
        aspects.push({
            title: `${dataProduct.namespace} APIs`,
            mandatory: true,
            apiResources: dataProduct.apiResources.map(({ ordId, minVersion }) => ({ ordId, minVersion })),
        });
    }

    if (dataProduct.eventResources.length > 0) {
        aspects.push({
            title: `${dataProduct.namespace} Events`,
            mandatory: true,
            eventResources: dataProduct.eventResources.map(({ ordId, minVersion }) => ({
                ordId,
                minVersion,
                subset: [{ eventType: "*" }],
            })),
        });
    }

    return {
        ordId,
        localId,
        title: `Integration with ${dataProduct.namespace}`,
        shortDescription: `Dependencies on ${dataProduct.namespace} Data Product`,
        description: `This integration dependency describes the resources consumed from ${dataProduct.namespace}.`,
        version: "1.0.0",
        lastUpdate: appConfig.lastUpdate,
        visibility: RESOURCE_VISIBILITY.public,
        releaseStatus: "active",
        mandatory: true,
        partOfPackage: packageId,
        aspects,
        ...ordExtensions,
    };
}

/**
 * Generates IntegrationDependencies for external Data Products.
 */
function getIntegrationDependencies(csn, appConfig, packageIds) {
    const externalDPs = collectExternalDataProducts(csn);
    if (externalDPs.length === 0) return [];

    return externalDPs.map((dp) => createIntegrationDependencyTemplate(dp, appConfig, packageIds));
}

module.exports = {
    getIntegrationDependencies,
    // Exported for testing
    parseDataProductOrdId,
    isExternalDataProduct,
    collectExternalDataProducts,
    createIntegrationDependencyTemplate,
};
