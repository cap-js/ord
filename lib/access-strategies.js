const cds = require("@sap/cds");
const { ORD_ACCESS_STRATEGY, AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP } = require("./constants");
const Logger = require("./logger");

/**
 * Derives ORD access strategies from authentication configuration.
 * This function is the main entry point for converting auth config to ORD document format.
 *
 * @param {string[]} accessStrategies - Array of access strategies (from ORD_ACCESS_STRATEGY)
 * @returns {Array<{type: string}>} Array of access strategy objects for ORD document
 *
 * @example
 * // With Basic auth configured
 * const accessStrategies = ['basic-auth'];
 * const strategies = getAccessStrategiesFromAuthConfig(accessStrategies);
 * // Returns: [{ type: 'basic-auth' }]
 *
 * @example
 * // With multiple access strategies
 * const accessStrategies = ['basic-auth', 'sap:cmp-mtls:v1'];
 * const strategies = getAccessStrategiesFromAuthConfig(accessStrategies);
 * // Returns: [{ type: 'basic-auth' }, { type: 'sap:cmp-mtls:v1' }]
 */
function getAccessStrategiesFromAuthConfig(accessStrategies) {
    if (!accessStrategies || !Array.isArray(accessStrategies)) {
        Logger.warn("getAccessStrategiesFromAuthConfig:", "Invalid authConfig, defaulting to 'open'");
        return [{ type: ORD_ACCESS_STRATEGY.Open }];
    }

    const strategies = accessStrategies
        .flatMap((strategy) => {
            if (!Object.values(ORD_ACCESS_STRATEGY).includes(strategy)) {
                Logger.warn(
                    "getAccessStrategiesFromAuthConfig:",
                    `Unknown access strategy type '${strategy}', skipping`,
                );
                return null;
            }

            return { type: strategy };
        })
        .filter(Boolean); // Remove null entries

    // If no valid strategies found, default to open
    if (strategies.length === 0) {
        return [{ type: ORD_ACCESS_STRATEGY.Open }];
    }

    return strategies;
}

/**
 * Checks if access strategies contain any non-open strategies.
 *
 * @param {Array<{type: string}>} accessStrategies - Array of access strategy objects
 * @returns {boolean} True if any non-open strategy is present
 */
function hasNonOpenStrategies(accessStrategies) {
    return (
        Array.isArray(accessStrategies) && accessStrategies.some((strategy) => strategy.type !== ORD_ACCESS_STRATEGY.Open)
    );
}

/**
 * Validates that 'open' strategy does not coexist with non-open strategies.
 * According to ORD specification, 'open' should not be mixed with authenticated strategies.
 *
 * @param {Array<{type: string}>} accessStrategies - Array of access strategy objects
 * @throws {Error} If 'open' coexists with non-open strategies
 */
function ensureNoOpenWhenNonOpenPresent(accessStrategies) {
    if (!Array.isArray(accessStrategies) || accessStrategies.length === 0) {
        return;
    }

    const hasOpen = accessStrategies.some((strategy) => strategy.type === ORD_ACCESS_STRATEGY.Open);
    const hasNonOpen = hasNonOpenStrategies(accessStrategies);

    if (hasOpen && hasNonOpen) {
        throw new Error(
            "Invalid access strategies: 'open' cannot coexist with authenticated strategies (basic-auth, sap:cmp-mtls:v1)",
        );
    }
}

/**
 * Ensures access strategies are valid and present, with configurable strict mode.
 * In non-strict mode (default), missing/empty strategies fallback to 'open' with error log.
 * In strict mode, missing/empty strategies throw an error.
 *
 * @param {Array<{type: string}>|undefined} accessStrategies - Array of access strategy objects
 * @param {Object} options - Validation options
 * @param {string} [options.resourceName] - Name of the resource (for error messages)
 * @param {boolean} [options.strict] - If true, throw error instead of fallback (default: reads from cds.env.ord.strictAccessStrategies)
 * @returns {Array<{type: string}>} Validated access strategies array
 * @throws {Error} In strict mode, if accessStrategies is missing or empty
 *
 * @example
 * // Non-strict mode (default) - fallback to open
 * const strategies = ensureAccessStrategies(undefined, { resourceName: 'MyAPI' });
 * // Logs error and returns: [{ type: 'open' }]
 *
 * @example
 * // Strict mode - throws error
 * const strategies = ensureAccessStrategies(undefined, {
 *   resourceName: 'MyAPI',
 *   strict: true
 * });
 * // Throws: Error with message about missing accessStrategies
 */
function ensureAccessStrategies(accessStrategies, options = {}) {
    const { resourceName = "unknown resource", strict } = options;

    // Determine strict mode: explicit parameter > config > default false
    const isStrict = strict !== undefined ? strict : cds.env.ord?.strictAccessStrategies === true;

    if (!Array.isArray(accessStrategies) || accessStrategies.length === 0) {
        const message = `[ORD] accessStrategies missing or empty for resource "${resourceName}"`;

        if (isStrict) {
            throw new Error(`${message}. Strict mode is enabled.`);
        } else {
            Logger.error("ensureAccessStrategies:", `${message}. Falling back to 'open'.`);
            return [{ type: ORD_ACCESS_STRATEGY.Open }];
        }
    }

    // Validate no mixing of 'open' with non-open strategies
    ensureNoOpenWhenNonOpenPresent(accessStrategies);

    return accessStrategies;
}

module.exports = {
    // Main API
    getAccessStrategiesFromAuthConfig,
    ensureAccessStrategies,

    // Helper functions
    hasNonOpenStrategies,
    ensureNoOpenWhenNonOpenPresent,

    // Constants (re-exported for convenience)
    AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP,
};
