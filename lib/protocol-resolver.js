const cds = require("@sap/cds");
const {
    CAP_TO_ORD_PROTOCOL_MAP,
    ORD_ONLY_PROTOCOLS,
    ORD_API_PROTOCOL,
    PLUGIN_UNSUPPORTED_PROTOCOLS,
} = require("./constants");
const Logger = require("./logger");

/**
 * Reads the explicit @protocol annotation from service definition.
 * Returns normalized array of protocol names (CDS uses both string and array formats).
 *
 * @param {Object} srvDefinition The service definition object.
 * @returns {Array<string>|null} Array of protocol names, or null if not explicitly set.
 */
function _getExplicitProtocols(srvDefinition) {
    const protocol = srvDefinition["@protocol"];
    if (!protocol) {
        return null;
    }
    return Array.isArray(protocol) ? protocol : [protocol];
}

/**
 * Resolves protocols for ORD API Resource generation.
 *
 * Three Rules:
 * - Rule A: Explicit protocol + empty endpoints → don't fallback to OData
 * - Rule B: Only fallback to OData when no explicit protocol
 * - Rule C: Never produce [null] in entryPoints
 *
 * @param {string} serviceName The service name.
 * @param {Object} srvDefinition The service definition object.
 * @param {Object} options Configuration options.
 * @param {Array} options.capEndpoints CAP endpoints from endpoints4().
 * @param {Function} options.isPrimaryDataProduct Strategy function to check if service is primary data product.
 * @returns {Array} Array of {apiProtocol, entryPoints, hasResourceDefinitions} objects.
 */
function resolveApiResourceProtocol(serviceName, srvDefinition, options = {}) {
    const { capEndpoints = [], isPrimaryDataProduct = () => false } = options;
    const explicitProtocols = _getExplicitProtocols(srvDefinition);
    const protocols = cds.service.protocols;
    const results = [];

    // Special Case: Primary Data Product services always use data subscription protocol
    if (isPrimaryDataProduct(srvDefinition)) {
        results.push({
            apiProtocol: ORD_API_PROTOCOL.SAP_DATA_SUBSCRIPTION,
            entryPoints: [],
            hasResourceDefinitions: true,
        });
        return results;
    }

    // Check for explicit @protocol annotation first (handles ORD-only protocols)
    if (explicitProtocols) {
        for (const protocol of explicitProtocols) {
            if (ORD_ONLY_PROTOCOLS[protocol]) {
                const ordProtocolConfig = ORD_ONLY_PROTOCOLS[protocol];
                results.push({
                    apiProtocol: ordProtocolConfig.apiProtocol,
                    entryPoints: ordProtocolConfig.hasEntryPoints ? [protocols.path4(srvDefinition)] : [],
                    hasResourceDefinitions: ordProtocolConfig.hasResourceDefinitions,
                });
            } else if (PLUGIN_UNSUPPORTED_PROTOCOLS.includes(protocol)) {
                Logger.warn(
                    `Protocol '${protocol}' is supported by ORD but this plugin cannot generate its resource definitions yet.`,
                );
            }
        }

        if (results.length > 0) {
            return results;
        }
    }

    // Filter out plugin-unsupported protocols from CAP endpoints
    const supportedEndpoints = capEndpoints.filter((endpoint) => {
        if (PLUGIN_UNSUPPORTED_PROTOCOLS.includes(endpoint.kind)) {
            Logger.warn(
                `Protocol '${endpoint.kind}' is supported by ORD but this plugin cannot generate its resource definitions yet.`,
            );
            return false;
        }
        return true;
    });

    // Case 1: CAP returned valid endpoints
    if (supportedEndpoints.length > 0) {
        supportedEndpoints.forEach((endpoint) => {
            const apiProtocol = CAP_TO_ORD_PROTOCOL_MAP[endpoint.kind] || endpoint.kind;
            results.push({
                apiProtocol,
                entryPoints: endpoint.path ? [endpoint.path] : [],
                hasResourceDefinitions: true,
            });
        });
        return results;
    }

    // Case 2: Explicit protocol but no supported endpoints → don't fallback
    if (explicitProtocols) {
        for (const protocol of explicitProtocols) {
            if (CAP_TO_ORD_PROTOCOL_MAP[protocol]) {
                Logger.warn(`Protocol '${protocol}' returned no endpoints from CDS, skipping.`);
            } else if (!ORD_ONLY_PROTOCOLS[protocol] && !PLUGIN_UNSUPPORTED_PROTOCOLS.includes(protocol)) {
                Logger.warn(`Unknown protocol '${protocol}' is not supported, skipping service '${serviceName}'.`);
            }
        }
        return [];
    }

    // Case 3: No explicit protocol, no CAP endpoints → fallback to OData
    const path = protocols.path4(srvDefinition);
    results.push({
        apiProtocol: ORD_API_PROTOCOL.ODATA_V4,
        entryPoints: path ? [path] : [],
        hasResourceDefinitions: true,
    });

    return results;
}

module.exports = {
    resolveApiResourceProtocol,
    // Exported for testing
    _getExplicitProtocols,
};
