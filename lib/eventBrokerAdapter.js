const Logger = require("./logger");
const cds = require("@sap/cds");

/**
 * Event Broker Plugin Adapter
 * Provides an abstraction layer for detecting and extracting ORD-relevant
 * information from @cap-js/event-broker messaging services.
 *
 * This enables automatic generation of ORD Integration Dependencies
 * for applications that consume events via SAP Cloud Application Event Hub.
 */

const EVENT_BROKER_KINDS = ["event-broker", "event-broker-internal"];
const BLOCKED_EVENT_TYPES = ["*", "cds.messaging.error"];

/**
 * Check if Event Broker plugin is available (configured in cds.env.requires)
 * @param {Object} envRequires - Optional cds.env.requires object for testing
 * @returns {boolean} True if event-broker is configured
 */
function isEventBrokerConfigured(envRequires = cds.env?.requires) {
    if (!envRequires) return false;

    // Check if any require entry has event-broker kind
    for (const [name, config] of Object.entries(envRequires)) {
        if (!config || typeof config !== "object") continue;

        // Direct kind match
        if (EVENT_BROKER_KINDS.includes(config.kind)) {
            Logger.log(`Event Broker found in cds.env.requires: ${name}`);
            return true;
        }

        // Check vcap label for bound services
        if (config.vcap?.label === "event-broker" || config.vcap?.label === "eventmesh-sap2sap-internal") {
            Logger.log(`Event Broker found via vcap label: ${name}`);
            return true;
        }
    }

    return false;
}

/**
 * Get all Event Broker messaging service configurations
 * @param {Object} envRequires - Optional cds.env.requires object for testing
 * @returns {Array<{name: string, config: Object}>} Array of event-broker service configs
 */
function getEventBrokerConfigs(envRequires = cds.env?.requires) {
    if (!envRequires) return [];

    const configs = [];
    for (const [name, config] of Object.entries(envRequires)) {
        if (!config || typeof config !== "object") continue;

        const isEventBroker =
            EVENT_BROKER_KINDS.includes(config.kind) ||
            config.vcap?.label === "event-broker" ||
            config.vcap?.label === "eventmesh-sap2sap-internal";

        if (isEventBroker) {
            configs.push({ name, config });
        }
    }

    return configs;
}

/**
 * Extract namespace from Event Broker credentials
 * The namespace is extracted from the ceSource credential property.
 *
 * @param {Object} credentials - Event Broker service credentials
 * @returns {string|null} Namespace or null if not found
 */
function extractNamespaceFromCredentials(credentials) {
    if (!credentials?.ceSource) {
        Logger.warn("Event Broker credentials do not contain ceSource");
        return null;
    }

    // ceSource is typically an array, take the first element
    const ceSource = Array.isArray(credentials.ceSource) ? credentials.ceSource[0] : credentials.ceSource;

    if (!ceSource || typeof ceSource !== "string") {
        Logger.warn("Invalid ceSource format in Event Broker credentials");
        return null;
    }

    // Extract namespace from ceSource (last segment after /)
    // Example: "/default/sap.s4/abcdef-1234" -> "abcdef-1234"
    const segments = ceSource.split("/");
    const namespace = segments[segments.length - 1];

    if (!namespace) {
        Logger.warn("Could not extract namespace from ceSource:", ceSource);
        return null;
    }

    Logger.log("Extracted namespace from Event Broker ceSource:", namespace);
    return namespace;
}

/**
 * Get consumed event types from a messaging service at runtime
 * This reads the subscribedTopics from the actual service instance.
 *
 * @param {Object} messagingService - CDS MessagingService instance
 * @returns {Array<string>} Array of event type strings
 */
function getConsumedEventTypesFromService(messagingService) {
    if (!messagingService) return [];

    // MessagingService stores subscribed topics in a Set
    const subscribedTopics = messagingService.subscribedTopics;
    if (!subscribedTopics || !(subscribedTopics instanceof Set)) {
        return [];
    }

    // Filter out wildcards and error events
    const eventTypes = [...subscribedTopics].filter((topic) => !BLOCKED_EVENT_TYPES.includes(topic));

    return eventTypes;
}

/**
 * Get all consumed event types from all Event Broker services at runtime
 * This aggregates events from all event-broker messaging services.
 * Falls back to configured consumedEventTypes if no runtime services available.
 *
 * @param {Object} options - Options
 * @param {Object} options.ordConfig - cds.env.ord configuration (for build-time)
 * @returns {Array<string>} Array of unique event type strings
 */
function getAllConsumedEventTypes(options = {}) {
    const eventTypes = new Set();
    const { ordConfig = cds.env?.ord } = options;

    // First try to get events from runtime services
    if (cds.services) {
        for (const [name, service] of Object.entries(cds.services)) {
            // Check if this is an event-broker messaging service
            if (service?.constructor?.name === "EventBroker" || service?.options?.kind?.startsWith("event-broker")) {
                const serviceEvents = getConsumedEventTypesFromService(service);
                serviceEvents.forEach((event) => eventTypes.add(event));
                Logger.log(`Found ${serviceEvents.length} consumed events from service: ${name}`);
            }
        }
    }

    // If no runtime events found, check for configured consumedEventTypes (build-time support)
    if (eventTypes.size === 0 && ordConfig?.consumedEventTypes) {
        const configuredEvents = Array.isArray(ordConfig.consumedEventTypes)
            ? ordConfig.consumedEventTypes
            : [ordConfig.consumedEventTypes];
        configuredEvents.forEach((event) => {
            if (typeof event === "string" && !BLOCKED_EVENT_TYPES.includes(event)) {
                eventTypes.add(event);
            }
        });
        if (eventTypes.size > 0) {
            Logger.log(`Found ${eventTypes.size} consumed events from ord config`);
        }
    }

    return [...eventTypes];
}

/**
 * Get Event Broker namespace from credentials
 * Tries to find credentials in the configured event-broker services.
 *
 * @param {Object} envRequires - Optional cds.env.requires object for testing
 * @returns {string|null} Namespace or null if not found
 */
function getEventBrokerNamespace(envRequires = cds.env?.requires) {
    const configs = getEventBrokerConfigs(envRequires);

    for (const { config } of configs) {
        const credentials = config.credentials;
        if (credentials) {
            const namespace = extractNamespaceFromCredentials(credentials);
            if (namespace) return namespace;
        }
    }

    return null;
}

/**
 * Check if Event Broker ORD integration is ready
 * This checks both configuration and runtime availability.
 *
 * @param {Object} options - Options for checking
 * @param {Object} options.envRequires - Custom cds.env.requires for testing
 * @returns {boolean} True if Event Broker ORD integration is ready
 */
function isEventBrokerReady(options = {}) {
    const { envRequires } = options;
    return isEventBrokerConfigured(envRequires);
}

/**
 * Get complete Event Broker ORD information
 * Aggregates all necessary data for generating Integration Dependencies.
 *
 * Note on parameter sources:
 * - `namespace` is extracted from Event Broker credentials (configuration)
 * - `eventTypes` come from runtime service subscriptions (cds.services)
 *
 * This is intentional: credentials define the source system identity (namespace),
 * while runtime services know which events the application actually subscribes to.
 * For build-time support, ordConfig.consumedEventTypes provides a fallback.
 *
 * @param {Object} options - Options
 * @param {Object} options.envRequires - Custom cds.env.requires for testing (affects namespace only)
 * @param {string} options.fallbackNamespace - Fallback namespace if not found in credentials
 * @param {Object} options.ordConfig - cds.env.ord configuration (for build-time event types)
 * @returns {Object|null} Event Broker ORD info or null if not available
 */
function getEventBrokerOrdInfo(options = {}) {
    const { envRequires, fallbackNamespace, ordConfig = cds.env?.ord } = options;

    if (!isEventBrokerReady({ envRequires })) {
        return null;
    }

    // Namespace from credentials (configuration source)
    const namespace = getEventBrokerNamespace(envRequires) || fallbackNamespace;
    // Event types from runtime services or ordConfig fallback
    const eventTypes = getAllConsumedEventTypes({ ordConfig });

    if (!namespace) {
        Logger.warn("Event Broker ORD: No namespace available");
        return null;
    }

    return {
        namespace,
        eventTypes,
        hasEvents: eventTypes.length > 0,
    };
}

module.exports = {
    isEventBrokerConfigured,
    isEventBrokerReady,
    getEventBrokerConfigs,
    extractNamespaceFromCredentials,
    getConsumedEventTypesFromService,
    getAllConsumedEventTypes,
    getEventBrokerNamespace,
    getEventBrokerOrdInfo,
    EVENT_BROKER_KINDS,
    BLOCKED_EVENT_TYPES,
};
