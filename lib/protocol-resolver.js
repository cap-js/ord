const cds = require("@sap/cds");
const {
    CAP_TO_ORD_PROTOCOL_MAP,
    ORD_ONLY_PROTOCOLS,
    ORD_API_PROTOCOL,
    PLUGIN_UNSUPPORTED_PROTOCOLS,
} = require("./constants");
const Logger = require("./logger");

/**
 * Gets CAP endpoints for a service using CDS endpoints4().
 *
 * @param {string} serviceName The service name.
 * @param {Object} srvDefinition The service definition object.
 * @returns {Array} Raw endpoints from CDS.
 */
function _getCapEndpoints(serviceName, srvDefinition) {
    const srvObj = { name: serviceName, definition: srvDefinition };
    return cds.service.protocols.endpoints4(srvObj);
}

/**
 * Reads the explicit @protocol annotation from service definition.
 * Returns normalized array of protocol names (CDS uses both string and array formats).
 *
 * @param {Object} srvDefinition The service definition object.
 * @returns {Array<string>} Array of protocol names, empty array if not explicitly set.
 */
function _getExplicitProtocols(srvDefinition) {
    const protocol = srvDefinition["@protocol"];
    if (!protocol) {
        return [];
    }
    return Array.isArray(protocol) ? protocol : [protocol];
}

/**
 * Creates a result object for data subscription protocol.
 * @returns {Object} Protocol result for data subscription.
 */
function _createDataSubscriptionResult() {
    return {
        apiProtocol: ORD_API_PROTOCOL.SAP_DATA_SUBSCRIPTION,
        entryPoints: [],
        hasResourceDefinitions: true,
    };
}

/**
 * Creates a result object for OData v4 fallback.
 * @param {Object} srvDefinition The service definition object.
 * @returns {Object} Protocol result for OData v4.
 */
function _createODataFallbackResult(srvDefinition) {
    const path = cds.service.protocols.path4(srvDefinition);
    return {
        apiProtocol: ORD_API_PROTOCOL.ODATA_V4,
        entryPoints: path ? [path] : [],
        hasResourceDefinitions: true,
    };
}

/**
 * Resolves ORD-only protocols (protocols that ORD supports but CAP doesn't serve).
 * Only processes protocols that are explicitly declared.
 *
 * @param {Object} srvDefinition The service definition object.
 * @param {Array<string>} explicit Array of explicitly declared protocols.
 * @returns {Array} Array of protocol results for ORD-only protocols.
 */
function _resolveOrdOnlyProtocols(srvDefinition, explicit) {
    const results = [];
    const protocols = cds.service.protocols;

    for (const protocol of explicit) {
        if (ORD_ONLY_PROTOCOLS[protocol]) {
            const ordProtocolConfig = ORD_ONLY_PROTOCOLS[protocol];
            const path = ordProtocolConfig.hasEntryPoints ? protocols.path4(srvDefinition) : null;
            results.push({
                apiProtocol: ordProtocolConfig.apiProtocol,
                entryPoints: path ? [path] : [],
                hasResourceDefinitions: ordProtocolConfig.hasResourceDefinitions,
            });
        } else if (PLUGIN_UNSUPPORTED_PROTOCOLS.includes(protocol)) {
            Logger.warn(
                `Protocol '${protocol}' is supported by ORD but this plugin cannot generate its resource definitions yet.`,
            );
        }
    }

    return results;
}

/**
 * Resolves CAP-served protocols by querying CDS endpoints.
 *
 * @param {string} serviceName The service name.
 * @param {Object} srvDefinition The service definition object.
 * @param {Array<string>} explicit Array of explicitly declared protocols.
 * @returns {Array} Array of protocol results from CAP endpoints.
 */
function _resolveCapEndpoints(serviceName, srvDefinition, explicit) {
    const capEndpoints = _getCapEndpoints(serviceName, srvDefinition);
    const results = [];

    // Filter out plugin-unsupported protocols
    const supportedEndpoints = capEndpoints.filter((endpoint) => {
        if (PLUGIN_UNSUPPORTED_PROTOCOLS.includes(endpoint.kind)) {
            Logger.warn(
                `Protocol '${endpoint.kind}' is supported by ORD but this plugin cannot generate its resource definitions yet.`,
            );
            return false;
        }
        return true;
    });

    // Process supported endpoints
    for (const endpoint of supportedEndpoints) {
        const apiProtocol = CAP_TO_ORD_PROTOCOL_MAP[endpoint.kind] ?? endpoint.kind;
        if (!apiProtocol) {
            Logger.warn(`Endpoint has no protocol kind for service '${serviceName}', skipping.`);
            continue;
        }
        results.push({
            apiProtocol,
            entryPoints: endpoint.path ? [endpoint.path] : [],
            hasResourceDefinitions: true,
        });
    }

    // If explicit protocols were set but CAP returned no endpoints, log warnings
    if (results.length === 0 && explicit.length > 0) {
        for (const protocol of explicit) {
            if (CAP_TO_ORD_PROTOCOL_MAP[protocol]) {
                Logger.warn(`Protocol '${protocol}' returned no endpoints from CDS for service '${serviceName}'.`);
            } else if (!ORD_ONLY_PROTOCOLS[protocol] && !PLUGIN_UNSUPPORTED_PROTOCOLS.includes(protocol)) {
                Logger.warn(`Unknown protocol '${protocol}' is not supported, skipping service '${serviceName}'.`);
            }
        }
    }

    return results;
}

/**
 * Resolves protocols for ORD API Resource generation.
 *
 * Design Principles:
 * - explicit protocols array is the "master switch" for all decisions
 * - Supports multi-protocol scenarios (e.g., @protocol: ['ina', 'odata'])
 * - Rule A: Explicit protocol + empty endpoints → don't fallback to OData
 * - Rule B: Only fallback to OData when no explicit protocol (explicit.length === 0)
 * - Rule C: Never produce [null] in entryPoints
 *
 * @param {string} serviceName The service name.
 * @param {Object} srvDefinition The service definition object.
 * @param {Object} options Configuration options.
 * @param {Function} options.isPrimaryDataProduct Strategy function to check if service is primary data product.
 * @returns {Array} Array of {apiProtocol, entryPoints, hasResourceDefinitions} objects.
 */
function resolveApiResourceProtocol(serviceName, srvDefinition, options = {}) {
    const { isPrimaryDataProduct = () => false } = options;
    const explicit = _getExplicitProtocols(srvDefinition);

    // 1. Primary Data Product - early return
    if (isPrimaryDataProduct(srvDefinition)) {
        return [_createDataSubscriptionResult()];
    }

    // 2. Collect results from all protocol sources
    // ORD-only protocols (e.g., ina) - only when explicitly declared
    const ordOnlyResults = explicit.length > 0 ? _resolveOrdOnlyProtocols(srvDefinition, explicit) : [];

    // CAP-served protocols (e.g., odata, rest)
    const capResults = _resolveCapEndpoints(serviceName, srvDefinition, explicit);

    // 3. Merge all results
    const allResults = [...ordOnlyResults, ...capResults];
    if (allResults.length > 0) {
        return allResults;
    }

    // 4. OData fallback (only when no explicit protocol)
    if (explicit.length === 0) {
        return [_createODataFallbackResult(srvDefinition)];
    }

    // 5. Explicit protocols but nothing resolved - warn and return empty
    Logger.warn(`Explicit protocols [${explicit.join(", ")}] produced no endpoints for service '${serviceName}'.`);
    return [];
}

module.exports = {
    resolveApiResourceProtocol,
    // Exported for testing
    _getExplicitProtocols,
};
