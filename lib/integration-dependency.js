const {
    DATA_PRODUCT_SIMPLE_ANNOTATION,
    EXTERNAL_DP_ORD_ID_ANNOTATION,
    EXTERNAL_SERVICE_ANNOTATION,
    INTEGRATION_DEPENDENCY_RESOURCE_NAME,
    ORD_RESOURCE_TYPE,
    RESOURCE_VISIBILITY,
} = require("./constants");
const { readORDExtensions, _getPackageID } = require("./templates");
const { getProvidedIntegrationDependencies, hasIntegrationDependencyProviders } = require("./extension-registry");
const Logger = require("./logger");
const _ = require("lodash");

/**
 * Resource name for event-based integration dependencies (consumed events).
 */
const EVENT_INTEGRATION_DEPENDENCY_RESOURCE_NAME = "consumedEvents";

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
        definition.kind === "service" &&
        definition[EXTERNAL_SERVICE_ANNOTATION] &&
        definition[DATA_PRODUCT_SIMPLE_ANNOTATION] &&
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
    // Omit computed fields to prevent silent overwrites
    const integrationDepConfig = appConfig.env?.integrationDependency || {};
    const safeConfig = _.omit(integrationDepConfig, ["ordId", "partOfPackage", "aspects"]);

    return {
        ...safeConfig, // User customization (excluding computed fields)
        ordId: `${appConfig.ordNamespace}:${ORD_RESOURCE_TYPE.integrationDependency}:${INTEGRATION_DEPENDENCY_RESOURCE_NAME}:v1`,
        title: safeConfig.title || "External Dependencies",
        version: safeConfig.version || "1.0.0",
        releaseStatus: safeConfig.releaseStatus || "active",
        visibility: safeConfig.visibility || RESOURCE_VISIBILITY.public,
        mandatory: safeConfig.mandatory ?? false,
        partOfPackage: packageId,
        aspects,
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
    const dependencies = [];

    // 1. API-based Integration Dependencies (External Data Products)
    const externalServices = collectExternalServices(csn);
    if (externalServices.length > 0) {
        dependencies.push(createIntegrationDependency(externalServices, appConfig, packageIds));
    }

    // 2. Event-based Integration Dependencies (from registered providers)
    const eventDependency = createEventIntegrationDependency(appConfig, packageIds);
    if (eventDependency) {
        dependencies.push(eventDependency);
    }

    return dependencies;
}

/**
 * Creates an Integration Dependency for consumed events.
 *
 * Collects eventResources from registered providers (e.g., Event Broker plugin).
 * Providers are responsible for building eventResources from their configuration.
 *
 * @param {Object} appConfig - The application configuration
 * @param {Array} packageIds - The available package identifiers
 * @returns {Object|null} IntegrationDependency object or null if no eventResources
 */
function createEventIntegrationDependency(appConfig, packageIds) {
    // Check if any providers are registered
    if (!hasIntegrationDependencyProviders()) {
        Logger.log("No Integration Dependency providers registered");
        return null;
    }

    // Get data from all registered providers
    const providedData = getProvidedIntegrationDependencies();
    if (providedData.length === 0) {
        Logger.log("No Integration Dependency data from providers");
        return null;
    }

    // Merge eventResources from all providers and build ORD structure
    const allEventResources = [];
    // Merge eventResources from all providers and build ORD structure
    const allEventResources = [];
    for (const data of providedData) {
        for (const resource of data.eventResources) {
            if (resource.ordId && Array.isArray(resource.events) && resource.events.length > 0) {
                // Build ORD eventResource structure with subset
                allEventResources.push({
                    ordId: resource.ordId,
                    subset: resource.events.map((eventType) => ({ eventType })),
                });
            }
        }
    }

    }

    if (allEventResources.length === 0) {
        Logger.log("No eventResources from providers");
        return null;
    }

    Logger.log(`Creating Event Integration Dependency with ${allEventResources.length} eventResource(s)`);

    const packageId = _getPackageID(
        appConfig.ordNamespace,
        packageIds,
        ORD_RESOURCE_TYPE.integrationDependency,
        RESOURCE_VISIBILITY.public,
    );

    // Read optional customization from cdsrc
    // Omit computed fields to prevent silent overwrites
    const eventIntegrationDepConfig = appConfig.env?.eventIntegrationDependency || {};
    const safeConfig = _.omit(eventIntegrationDepConfig, ["ordId", "partOfPackage", "aspects", "aspect"]);
    const aspectConfig = eventIntegrationDepConfig.aspect || {};
    const safeAspectConfig = _.omit(aspectConfig, ["eventResources"]);

    return {
        ...safeConfig, // User customization (excluding computed fields)
        ordId: `${appConfig.ordNamespace}:${ORD_RESOURCE_TYPE.integrationDependency}:${EVENT_INTEGRATION_DEPENDENCY_RESOURCE_NAME}:v1`,
        title: safeConfig.title || "Consumed Events",
        version: safeConfig.version || "1.0.0",
        releaseStatus: safeConfig.releaseStatus || "active",
        visibility: safeConfig.visibility || RESOURCE_VISIBILITY.public,
        mandatory: safeConfig.mandatory ?? false,
        partOfPackage: packageId,
        aspects: [
            {
                ...safeAspectConfig, // Allow aspect customization (excluding eventResources)
                title: safeAspectConfig.title || "Subscribed Event Types",
                mandatory: safeAspectConfig.mandatory ?? false,
                eventResources: allEventResources,
            },
        ],
    };
}

module.exports = {
    getIntegrationDependencies,
    // Exported for testing
    collectExternalServices,
    createIntegrationDependency,
    createEventIntegrationDependency,
    parseDataProductOrdId,
    isExternalDataProduct,
    EVENT_INTEGRATION_DEPENDENCY_RESOURCE_NAME,
};
