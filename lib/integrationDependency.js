const {
    DATA_PRODUCT_SHORTEN_ANNOTATION,
    EXTERNAL_DP_ORD_ID_ANNOTATION,
    EXTERNAL_SERVICE_ANNOTATION,
    INTEGRATION_DEPENDENCY_RESOURCE_NAME,
    ORD_RESOURCE_TYPE,
    RESOURCE_VISIBILITY,
} = require("./constants");
const { readORDExtensions, _getPackageID } = require("./templates");

/**
 * Parses @cds.dp.ordId annotation to extract resource information.
 * @param {string} ordId - e.g., "sap.sai:apiResource:Supplier:v1"
 * @returns {Object} { namespace, resourceType, resourceName, version }
 */
function parseDataProductOrdId(ordId) {
    const [namespace, resourceType, resourceName, version = "v1"] = ordId.split(":");
    return { namespace, resourceType, resourceName, version };
}

/**
 * Checks if a CSN definition is an external Data Product.
 * @param {Object} definition - CSN definition object
 * @returns {boolean}
 */
function isExternalDataProduct(definition) {
    return !!(
        definition[EXTERNAL_SERVICE_ANNOTATION] &&
        definition[DATA_PRODUCT_SHORTEN_ANNOTATION] &&
        definition[EXTERNAL_DP_ORD_ID_ANNOTATION]
    );
}

/**
 * Collects external services from CSN definitions.
 * Returns a flat list of external services (one per service, no namespace grouping).
 * @param {Object} csn - The CSN definitions object
 * @returns {Array} Array of external service objects
 */
function collectExternalServices(csn) {
    const externalServices = [];

    for (const [serviceName, definition] of Object.entries(csn.definitions)) {
        if (!isExternalDataProduct(definition)) continue;

        const dpOrdId = definition[EXTERNAL_DP_ORD_ID_ANNOTATION];
        const { resourceType, version } = parseDataProductOrdId(dpOrdId);

        // Only support apiResource for now
        if (resourceType !== "apiResource") continue;

        externalServices.push({
            serviceName,
            ordId: dpOrdId,
            minVersion: version.replace("v", "") + ".0.0",
            definition,
        });
    }

    return externalServices;
}

/**
 * Creates a single IntegrationDependency with one aspect per external service.
 * @param {Array} externalServices - Array of external service objects
 * @param {Object} appConfig - The application configuration
 * @param {Array} packageIds - The available package identifiers
 * @returns {Object} IntegrationDependency object
 */
function createIntegrationDependency(externalServices, appConfig, packageIds) {
    const packageId = _getPackageID(
        appConfig.ordNamespace,
        packageIds,
        ORD_RESOURCE_TYPE.integrationDependency,
        RESOURCE_VISIBILITY.public,
    );

    // Create one aspect per external service
    const aspects = externalServices.map((service) => {
        const ordExtensions = readORDExtensions(service.definition || {});
        return {
            title: service.serviceName,
            mandatory: false,
            apiResources: [{ ordId: service.ordId, minVersion: service.minVersion }],
            ...ordExtensions, // Allow customization via @ORD.Extensions on the service
        };
    });

    // Read IntegrationDependency level config from cdsrc
    const integrationDepConfig = appConfig.env?.integrationDependency || {};

    return {
        ordId: `${appConfig.ordNamespace}:${ORD_RESOURCE_TYPE.integrationDependency}:${INTEGRATION_DEPENDENCY_RESOURCE_NAME}:v1`,
        title: "External Dependencies",
        version: "1.0.0",
        releaseStatus: "active",
        visibility: RESOURCE_VISIBILITY.public,
        mandatory: false,
        partOfPackage: packageId,
        aspects,
        ...integrationDepConfig, // Allow customization via cdsrc
    };
}

/**
 * Generates a single IntegrationDependency for all external services.
 * @param {Object} csn - The CSN definitions object
 * @param {Object} appConfig - The application configuration
 * @param {Array} packageIds - The available package identifiers
 * @returns {Array} Array containing single IntegrationDependency or empty array
 */
function getIntegrationDependencies(csn, appConfig, packageIds) {
    const externalServices = collectExternalServices(csn);
    if (externalServices.length === 0) return [];

    return [createIntegrationDependency(externalServices, appConfig, packageIds)];
}

module.exports = {
    getIntegrationDependencies,
    // Exported for testing
    collectExternalServices,
    createIntegrationDependency,
    parseDataProductOrdId,
    isExternalDataProduct,
};
