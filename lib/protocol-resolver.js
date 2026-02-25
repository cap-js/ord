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
 *
 * @param {Object} srvDefinition The service definition object.
 * @returns {string[]} Array of protocol names, or empty array if not explicitly set.
 */
function _getExplicitProtocol(srvDefinition) {
    const protocol = srvDefinition["@protocol"];
    if (!protocol) {
        return [];
    }
    return Array.isArray(protocol) ? protocol : [protocol];
}

/**
 * Resolves protocol for ORD API Resource generation.
 *
 * Design Principles:
 * - explicit protocol is the "master switch" for all decisions
 * - Rule A: Explicit protocol + empty endpoints → don't fallback to OData
 * - Rule B: Only fallback to OData when no explicit protocol
 * - Rule C: Never produce [null] in entryPoints
 *
 * @param {string} serviceName The service name.
 * @param {Object} srvDefinition The service definition object.
 * @param {Object} options Configuration options.
 * @param {Function} options.isPrimaryDataProduct Strategy function to check if service is primary data product.
 * @returns {Array} Array with single {apiProtocol, entryPoints, hasResourceDefinitions} object, or empty array.
 */
function resolveApiResourceProtocol(serviceName, srvDefinition, options = {}) {
    const { isPrimaryDataProduct = () => false } = options;

    // 1. Primary Data Product - early return
    if (isPrimaryDataProduct(srvDefinition)) {
        return [
            {
                apiProtocol: ORD_API_PROTOCOL.SAP_DATA_SUBSCRIPTION,
                entryPoints: [],
                hasResourceDefinitions: true,
            },
        ];
    }

    const capEndpoints = _getCapEndpoints(serviceName, srvDefinition);
    const protocols = [];
    for (const endpoint of capEndpoints) {
        if (PLUGIN_UNSUPPORTED_PROTOCOLS.includes(endpoint.kind)) {
            Logger.warn(
                `Protocol '${endpoint.kind}' is supported by ORD but this plugin cannot generate its resource definitions yet.`,
            );
            continue;
        }

        const apiProtocol = CAP_TO_ORD_PROTOCOL_MAP[endpoint.kind] ?? endpoint.kind;
        if (apiProtocol) {
            protocols.push({
                apiProtocol,
                entryPoints: endpoint.path ? [endpoint.path] : [],
                hasResourceDefinitions: true,
            });
        }
    }

    const explicit = _getExplicitProtocol(srvDefinition);
    for (const protocol of explicit) {
        // 2. Handle explicit protocol
        // 2a. Check if it's an ORD-only protocol (e.g., INA)
        if (ORD_ONLY_PROTOCOLS[protocol]) {
            const config = ORD_ONLY_PROTOCOLS[protocol];
            const path = config.hasEntryPoints ? cds.service.protocols.path4(srvDefinition) : null;
            protocols.push({
                apiProtocol: config.apiProtocol,
                entryPoints: path ? [path] : [],
                hasResourceDefinitions: config.hasResourceDefinitions,
            });
            continue;
        }

        // 2b. Check if it's a plugin-unsupported protocol
        if (PLUGIN_UNSUPPORTED_PROTOCOLS.includes(protocol)) {
            Logger.warn(
                `Protocol '${protocol}' is supported by ORD but this plugin cannot generate its resource definitions yet.`,
            );
            continue;
        }

        // 4. Handle explicit protocol with no CAP endpoint (Rule A)
        // 4. Handle explicit protocol with no CAP endpoint (Rule A)
        if (!protocols.some((p) => p.apiProtocol === protocol)) {
            Logger.warn(`Unknown protocol '${protocol}' is not supported, and skipped for service '${serviceName}'.`);
        }
    }

    // no protocol found via CAP endpoints, but explicit protocol(s) defined → Rule A: don't fallback to OData, return empty array
    if (protocols.length === 0 && explicit.length > 0) {
        return [];
    }

    if (protocols.length > 0) {
        return protocols;
    }

    // 5. No explicit protocol and no CAP endpoint - fallback to OData (Rule B)
    const path = cds.service.protocols.path4(srvDefinition);
    return [
        {
            apiProtocol: ORD_API_PROTOCOL.ODATA_V4,
            entryPoints: path ? [path] : [],
            hasResourceDefinitions: true,
        },
    ];
}

module.exports = {
    resolveApiResourceProtocol,
    // Exported for testing
    _getExplicitProtocol,
};
