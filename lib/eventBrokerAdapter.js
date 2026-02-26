const Logger = require("./logger");
const cds = require("@sap/cds");

/**
 * Event Broker Plugin Adapter
 * Provides an abstraction layer for detecting and extracting ORD-relevant
 * information from @cap-js/event-broker messaging services.
 *
 * This enables automatic generation of ORD Integration Dependencies
 * for applications that consume events via SAP Cloud Application Event Hub.
 *
 * Event Type Sources (in priority order):
 * 1. Runtime: cds.services.*.subscribedTopics (automatic, runtime only)
 * 2. CDS Model: Events with @ORD.Extensions.consumedEvent annotation (automatic, build + runtime)
 * 3. Config: cds.ord.consumedEventTypes in package.json (manual fallback)
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
 * Get consumed event types from CDS model definitions
 * Looks for event definitions with @ORD.Extensions.consumedEvent annotation.
 * The event type is determined by @topic annotation or the fully qualified event name.
 *
 * Example CDS:
 * ```
 * @ORD.Extensions.consumedEvent
 * @topic: 'sap.s4.beh.businesspartner.v1.BusinessPartner.Changed.v1'
 * event BusinessPartnerChanged { ... }
 * ```
 *
 * @param {Object} csn - CDS CSN model (linked or unlinked)
 * @returns {Array<string>} Array of event type strings
 */
function getConsumedEventTypesFromCsn(csn) {
    if (!csn?.definitions) return [];

    const eventTypes = [];

    for (const [name, def] of Object.entries(csn.definitions)) {
        if (def.kind !== "event") continue;

        // Check for @ORD.Extensions.consumedEvent annotation
        // Also support shorthand @ORD.consumedEvent
        const isConsumedEvent = def["@ORD.Extensions.consumedEvent"] === true || def["@ORD.consumedEvent"] === true;

        if (!isConsumedEvent) continue;

        // Get event type from @topic annotation, or use the fully qualified name
        const eventType = def["@topic"] || name;

        if (typeof eventType === "string" && !BLOCKED_EVENT_TYPES.includes(eventType)) {
            eventTypes.push(eventType);
            Logger.log(`Found consumed event from CDS model: ${eventType}`);
        }
    }

    return eventTypes;
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
 * Get all consumed event types from all available sources.
 * Sources are checked in priority order:
 * 1. Runtime services (subscribedTopics) - most accurate, only at runtime
 * 2. CDS model (@ORD.Extensions.consumedEvent) - works at build and runtime
 * 3. Config (cds.ord.consumedEventTypes) - manual fallback
 *
 * @param {Object} options - Options
 * @param {Object} options.ordConfig - cds.env.ord configuration (for config fallback)
 * @param {Object} options.csn - CDS CSN model (for model-based detection)
 * @returns {Array<string>} Array of unique event type strings
 */
function getAllConsumedEventTypes(options = {}) {
    const eventTypes = new Set();
    const { ordConfig = cds.env?.ord, csn } = options;

    // Priority 1: Runtime services (subscribedTopics)
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

    // Priority 2: CDS model (@ORD.Extensions.consumedEvent annotation)
    if (eventTypes.size === 0 && csn) {
        const csnEvents = getConsumedEventTypesFromCsn(csn);
        csnEvents.forEach((event) => eventTypes.add(event));
        if (csnEvents.length > 0) {
            Logger.log(`Found ${csnEvents.length} consumed events from CDS model`);
        }
    }

    // Priority 3: Config fallback (cds.ord.consumedEventTypes)
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
 * - `eventTypes` come from multiple sources (see getAllConsumedEventTypes)
 *
 * Event type sources in priority order:
 * 1. Runtime services (subscribedTopics) - only at runtime
 * 2. CDS model (@ORD.Extensions.consumedEvent) - build + runtime
 * 3. Config (cds.ord.consumedEventTypes) - manual fallback
 *
 * @param {Object} options - Options
 * @param {Object} options.envRequires - Custom cds.env.requires for testing (affects namespace only)
 * @param {string} options.fallbackNamespace - Fallback namespace if not found in credentials
 * @param {Object} options.ordConfig - cds.env.ord configuration (for config fallback)
 * @param {Object} options.csn - CDS CSN model (for model-based event detection)
 * @returns {Object|null} Event Broker ORD info or null if not available
 */
function getEventBrokerOrdInfo(options = {}) {
    const { envRequires, fallbackNamespace, ordConfig = cds.env?.ord, csn } = options;

    if (!isEventBrokerReady({ envRequires })) {
        return null;
    }

    // Namespace from credentials (configuration source)
    const namespace = getEventBrokerNamespace(envRequires) || fallbackNamespace;
    // Event types from all sources (runtime > CSN > config)
    const eventTypes = getAllConsumedEventTypes({ ordConfig, csn });

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
    getConsumedEventTypesFromCsn,
    getConsumedEventTypesFromService,
    getAllConsumedEventTypes,
    getEventBrokerNamespace,
    getEventBrokerOrdInfo,
    EVENT_BROKER_KINDS,
    BLOCKED_EVENT_TYPES,
};
