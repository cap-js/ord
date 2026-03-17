/**
 * Extension Registry for ORD Plugin
 *
 * Enables external plugins (e.g., Event Broker) to register providers
 * for Integration Dependency data at runtime.
 *
 * This follows the same pattern as the Java plugin's Spring DI mechanism
 * where OrdIntegrationDependencyProvider beans are auto-discovered.
 *
 * @module extensionRegistry
 */

const Logger = require("./logger");

/**
 * Array of registered Integration Dependency provider functions.
 * @type {Array<Function>}
 * @private
 */
const integrationDependencyProviders = [];

/**
 * @typedef {Object} EventResourceInput
 * @property {string} ordId - Event resource ORD ID (e.g., "sap.s4:eventResource:CE_SALESORDEREVENTS:v1")
 * @property {Array<string>} events - Array of event type names
 */

/**
 * @typedef {Object} IntegrationDependencyData
 * @property {Array<EventResourceInput>} eventResources - Array of event resources with their events
 */

/**
 * Register a provider function for Integration Dependency data.
 *
 * External plugins call this at startup to register their provider function.
 * The provider will be called during ORD document generation.
 *
 * @param {Function} provider - Function that returns IntegrationDependencyData or null
 *
 * @example
 * // In Event Broker Plugin:
 * const ord = require("@cap-js/ord");
 * ord.registerIntegrationDependencyProvider(() => ({
 *     eventResources: [
 *         {
 *             ordId: "sap.s4:eventResource:CE_SALESORDEREVENTS:v1",
 *             events: ["sap.s4.beh.salesorder.v1.SalesOrder.Changed.v1"]
 *         }
 *     ]
 * }));
 */
function registerIntegrationDependencyProvider(provider) {
    if (typeof provider !== "function") {
        throw new Error("Integration Dependency provider must be a function");
    }
    integrationDependencyProviders.push(provider);
    Logger.log("Registered Integration Dependency provider");
}

/**
 * Get Integration Dependency data from all registered providers.
 *
 * Called by integrationDependency.js during ORD document generation.
 * Each provider is invoked and results are filtered for valid responses.
 *
 * @returns {Array<IntegrationDependencyData>} Array of provider results
 */
function getProvidedIntegrationDependencies() {
    return integrationDependencyProviders
        .map((provider) => {
            try {
                return provider();
            } catch (error) {
                // Log but don't fail - provider errors shouldn't break ORD generation
                Logger.warn("Integration Dependency provider failed:", error.message);
                return null;
            }
        })
        .filter((result) => {
            // Validate result structure - must have eventResources array
            if (!result) return false;
            if (!Array.isArray(result.eventResources) || result.eventResources.length === 0) {
                Logger.log("Integration Dependency provider returned no eventResources");
                return false;
            }
            return true;
        });
}

/**
 * Check if any Integration Dependency providers are registered.
 *
 * @returns {boolean} True if at least one provider is registered
 */
function hasIntegrationDependencyProviders() {
    return integrationDependencyProviders.length > 0;
}

/**
 * Clear all registered providers.
 * For testing purposes only.
 *
 * @private
 */
function _clearProviders() {
    integrationDependencyProviders.length = 0;
}

/**
 * Get the number of registered providers.
 * For testing purposes only.
 *
 * @returns {number} Number of registered providers
 * @private
 */
function _getProviderCount() {
    return integrationDependencyProviders.length;
}

module.exports = {
    registerIntegrationDependencyProvider,
    getProvidedIntegrationDependencies,
    hasIntegrationDependencyProviders,
    // Test utilities
    _clearProviders,
    _getProviderCount,
};
