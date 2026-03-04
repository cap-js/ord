const {
    DATA_PRODUCT_SIMPLE_ANNOTATION,
    EXTERNAL_DP_ORD_ID_ANNOTATION,
    EXTERNAL_SERVICE_ANNOTATION,
    INTEGRATION_DEPENDENCY_RESOURCE_NAME,
    ORD_RESOURCE_TYPE,
    RESOURCE_VISIBILITY,
} = require("./constants");
const { readORDExtensions, _getPackageID } = require("./templates");
const {
    isEventBrokerConfigured,
    getEventBrokerNamespace,
    getSubscribedTopics,
    isRuntimeContext,
} = require("./eventBrokerAdapter");
const Logger = require("./logger");

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
    const integrationDependencies = [];

    // 1. External Data Product services
    const externalServices = collectExternalServices(csn);
    if (externalServices.length > 0) {
        integrationDependencies.push(createIntegrationDependency(externalServices, appConfig, packageIds));
    }

    // 2. Event-based Integration Dependencies (for Event Broker)
    const eventServices = collectEventBasedServices(csn);

    // Create Event Integration Dependency if:
    // 1. There are CDS-annotated event services, OR
    // 2. We're in runtime context with Event Broker configured (pure runtime mode)
    const hasAnnotatedEvents = eventServices.length > 0;
    const hasRuntimeContext = isRuntimeContext() && isEventBrokerConfigured();

    if (hasAnnotatedEvents || hasRuntimeContext) {
        const eventIntDep = createEventIntegrationDependency(eventServices, appConfig, packageIds);
        if (eventIntDep) {
            integrationDependencies.push(eventIntDep);
        }
    }

    return integrationDependencies;
}

/**
 * Collects services annotated with @ORD.Extensions.integrationDependency and their events.
 * @param {Object} csn - The CSN definitions object
 * @returns {Array} Array of { serviceName, events, ordExtensions }
 */
function collectEventBasedServices(csn) {
    const services = [];

    for (const [serviceName, definition] of Object.entries(csn.definitions)) {
        if (definition.kind !== "service") continue;
        if (!definition["@ORD.Extensions.integrationDependency"]) continue;

        // Collect events belonging to this service
        const events = [];
        for (const [defName, def] of Object.entries(csn.definitions)) {
            if (def.kind !== "event") continue;
            if (!defName.startsWith(serviceName + ".")) continue;

            // Get event type from @topic annotation or use the event name
            const eventType = def["@topic"] || defName;
            events.push({
                name: defName,
                eventType,
                definition: def,
            });
        }

        if (events.length > 0) {
            services.push({
                serviceName,
                events,
                ordExtensions: readORDExtensions(definition),
                definition,
            });
        }
    }

    return services;
}

/**
 * Creates an IntegrationDependency for event-based services.
 * @param {Array} eventServices - Array of event service objects
 * @param {Object} appConfig - The application configuration
 * @param {Array} packageIds - The available package identifiers
 * @returns {Object|null} IntegrationDependency object or null
 */
function createEventIntegrationDependency(eventServices, appConfig, packageIds) {
    // Note: eventServices may be empty in pure-runtime mode; proceed to collect runtime topics

    const packageId = _getPackageID(
        appConfig.ordNamespace,
        packageIds,
        ORD_RESOURCE_TYPE.integrationDependency,
        RESOURCE_VISIBILITY.public,
    );

    // Determine eventResourcesNamespace:
    // 1. From @ORD.Extensions.eventResourcesNamespace annotation
    // 2. Fallback to Event Broker ceSource namespace
    let eventResourcesNamespace = null;
    for (const service of eventServices) {
        if (service.ordExtensions?.eventResourcesNamespace) {
            eventResourcesNamespace = service.ordExtensions.eventResourcesNamespace;
            break;
        }
    }

    // Fallback to Event Broker namespace if not explicitly set
    if (!eventResourcesNamespace && isEventBrokerConfigured()) {
        eventResourcesNamespace = getEventBrokerNamespace();
        if (eventResourcesNamespace) {
            Logger.log(`Using Event Broker namespace for Integration Dependency: ${eventResourcesNamespace}`);
        }
    }

    if (!eventResourcesNamespace) {
        Logger.warn("Event Integration Dependency skipped: no eventResourcesNamespace available");
        return null;
    }

    // Collect all event types from:
    // 1. CDS annotations (@topic on events) - Build-Time
    // 2. Runtime subscribedTopics from Event Broker messaging services - Runtime
    const allEventTypes = new Set();

    // Build-Time: CDS annotations
    for (const service of eventServices) {
        for (const event of service.events) {
            allEventTypes.add(event.eventType);
            Logger.log(`Found CDS event type: ${event.eventType}`);
        }
    }

    // Runtime: Add subscribedTopics from Event Broker messaging services
    if (isRuntimeContext()) {
        const runtimeTopics = getSubscribedTopics();
        for (const topic of runtimeTopics) {
            if (!allEventTypes.has(topic)) {
                allEventTypes.add(topic);
                Logger.log(`Found Runtime subscribed topic: ${topic}`);
            }
        }
    }

    // If no events found, skip Integration Dependency
    if (allEventTypes.size === 0) {
        Logger.warn("Event Integration Dependency skipped: no events found");
        return null;
    }

    // Create a single aspect with all event resources
    const aspects = [
        {
            title: "Consumed Events",
            mandatory: false,
            eventResources: [
                {
                    ordId: `${eventResourcesNamespace}:eventResource:RawEvent:v1`,
                    subset: Array.from(allEventTypes).map((eventType) => ({ eventType })),
                },
            ],
        },
    ];

    // Read IntegrationDependency level config from cdsrc (applied first, then overwritten by computed fields)
    const integrationDepConfig = appConfig.env?.integrationDependency || {};

    return {
        // Apply config first so computed fields cannot be accidentally overwritten
        ...integrationDepConfig,
        // Computed/structural fields (protected from config override)
        ordId: `${appConfig.ordNamespace}:${ORD_RESOURCE_TYPE.integrationDependency}:consumedEvents:v1`,
        title: integrationDepConfig.title || "Consumed Events",
        shortDescription:
            integrationDepConfig.shortDescription || "Integration dependency for consumed events from external systems",
        version: integrationDepConfig.version || "1.0.0",
        releaseStatus: integrationDepConfig.releaseStatus || "active",
        visibility: integrationDepConfig.visibility || RESOURCE_VISIBILITY.public,
        mandatory: integrationDepConfig.mandatory ?? false,
        partOfPackage: packageId,
        aspects,
    };
}

module.exports = {
    getIntegrationDependencies,
    // Exported for testing
    collectExternalServices,
    createIntegrationDependency,
    parseDataProductOrdId,
    isExternalDataProduct,
    // Event-based Integration Dependencies
    collectEventBasedServices,
    createEventIntegrationDependency,
};
