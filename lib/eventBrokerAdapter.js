/**
 * Event Broker Plugin Adapter
 *
 * Provides Event Broker detection and namespace extraction for ORD Integration Dependencies.
 * This adapter enables automatic namespace detection from Event Broker credentials (ceSource).
 */

const cds = require("@sap/cds");
const Logger = require("./logger");

/**
 * Known Event Broker service kinds
 */
const EVENT_BROKER_KINDS = ["event-broker", "event-broker-ias"];

/**
 * Check if Event Broker is configured in cds.env.requires
 *
 * @param {Object} envRequires - Optional cds.env.requires object for testing
 * @returns {boolean} True if Event Broker is configured
 */
function isEventBrokerConfigured(envRequires = cds.env?.requires) {
    if (!envRequires) return false;

    for (const [name, config] of Object.entries(envRequires)) {
        if (!config || typeof config !== "object") continue;

        // Check kind directly
        if (config.kind && EVENT_BROKER_KINDS.some((kind) => config.kind.startsWith(kind))) {
            Logger.log(`Event Broker found in cds.env.requires: ${name}`);
            return true;
        }

        // Check vcap label (for Cloud Foundry bindings)
        if (config.vcap?.label && EVENT_BROKER_KINDS.some((kind) => config.vcap.label.includes(kind))) {
            Logger.log(`Event Broker found via vcap label: ${name}`);
            return true;
        }
    }

    return false;
}

/**
 * Get all Event Broker messaging service configurations
 *
 * @param {Object} envRequires - Optional cds.env.requires object for testing
 * @returns {Array} Array of { name, config } objects for Event Broker services
 */
function getEventBrokerConfigs(envRequires = cds.env?.requires) {
    if (!envRequires) return [];

    const configs = [];
    for (const [name, config] of Object.entries(envRequires)) {
        if (!config || typeof config !== "object") continue;

        const isEventBroker =
            (config.kind && EVENT_BROKER_KINDS.some((kind) => config.kind.startsWith(kind))) ||
            (config.vcap?.label && EVENT_BROKER_KINDS.some((kind) => config.vcap.label.includes(kind)));

        if (isEventBroker) {
            configs.push({ name, config });
        }
    }

    return configs;
}

/**
 * Extract namespace from Event Broker credentials ceSource.
 *
 * ceSource format: "/default/<namespace>/..." or "/<namespace>/..."
 * Examples:
 *   "/default/sap.s4/source-system" -> "sap.s4"
 *   "/default/beb-demo-nodejs/local" -> "beb-demo-nodejs"
 *
 * @param {Object} credentials - Event Broker service credentials
 * @returns {string|null} Extracted namespace or null
 */
function extractNamespaceFromCredentials(credentials) {
    if (!credentials) return null;

    // ceSource can be a string or an array
    const ceSource = Array.isArray(credentials.ceSource) ? credentials.ceSource[0] : credentials.ceSource;

    if (!ceSource || typeof ceSource !== "string") {
        Logger.warn("Event Broker credentials do not contain ceSource");
        return null;
    }

    // Parse ceSource: "/default/<namespace>/..." or "/<namespace>/..."
    const parts = ceSource.split("/").filter(Boolean);

    if (parts.length < 2) {
        Logger.warn("Invalid ceSource format in Event Broker credentials");
        return null;
    }

    // If first part is "default", namespace is second part, otherwise first part
    let namespace;
    if (parts[0] === "default") {
        namespace = parts[1];
    } else {
        namespace = parts[0];
    }

    Logger.log("Extracted namespace from Event Broker ceSource:", namespace);
    return namespace;
}

/**
 * Get Event Broker namespace from credentials.
 * Tries to find ceSource in the configured event-broker services.
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

module.exports = {
    isEventBrokerConfigured,
    getEventBrokerConfigs,
    getEventBrokerNamespace,
    extractNamespaceFromCredentials,
    EVENT_BROKER_KINDS,
};
