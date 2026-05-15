const cds = require("@sap/cds");

const Logger = require("./logger");
const { isPrimaryDataProductService } = require("./common/utils");
const {
    CAP_TO_ORD_PROTOCOL_MAP,
    ORD_ONLY_PROTOCOLS,
    ORD_API_PROTOCOL,
    PLUGIN_UNSUPPORTED_PROTOCOLS,
} = require("./constants");

/**
 * Resolves protocol for ORD API Resource generation.
 *
 * Design Principles:
 * - explicit protocol is the "master switch" for all decisions
 * - Rule A: Explicit protocol + empty endpoints → don't fall back to OData
 * - Rule B: Only fallback to OData when no explicit protocol
 * - Rule C: Never produce [null] in entryPoints
 *
 * @param {Object} srvDefinition The service definition object.
 * @returns {Array} Array with single {apiProtocol, entryPoints, hasResourceDefinitions} object, or empty array.
 */
function resolveApiResourceProtocol(srvDefinition) {
    // 1. Primary Data Product - early return
    if (isPrimaryDataProductService(srvDefinition)) {
        return [
            {
                apiProtocol: ORD_API_PROTOCOL.SAP_DATA_SUBSCRIPTION,
                entryPoints: [],
                hasResourceDefinitions: true,
            },
        ];
    }

    const capEndpoints = cds.service.protocols.endpoints4({ name: srvDefinition.name, definition: srvDefinition });
    const ordProtocols = [];
    for (const endpoint of capEndpoints) {
        if (PLUGIN_UNSUPPORTED_PROTOCOLS.includes(endpoint.kind)) {
            Logger.warn(
                `Protocol '${endpoint.kind}' is supported by ORD but this plugin cannot generate its resource definitions yet.`,
            );
            continue;
        }

        const apiProtocol = CAP_TO_ORD_PROTOCOL_MAP[endpoint.kind] ?? endpoint.kind;
        if (apiProtocol) {
            ordProtocols.push({
                apiProtocol,
                entryPoints: endpoint.path ? [endpoint.path] : [],
                hasResourceDefinitions: true,
            });
        }
    }

    const cdsProtocols = Object.keys(cds.service.protocols.for(srvDefinition));
    for (const protocol of cdsProtocols) {
        // 2. Handle explicit protocol
        // 2a. Check if it's an ORD-only protocol (e.g., INA)
        if (ORD_ONLY_PROTOCOLS[protocol]) {
            const config = ORD_ONLY_PROTOCOLS[protocol];
            const path = config.hasEntryPoints ? cds.service.protocols.path4(srvDefinition) : null;
            ordProtocols.push({
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
        if (!ordProtocols.some((p) => p.apiProtocol === protocol) && !CAP_TO_ORD_PROTOCOL_MAP[protocol]) {
            Logger.warn(
                `Unknown protocol '${protocol}' is not supported, and skipped for service '${srvDefinition.name}'.`,
            );
        }
    }

    return ordProtocols;
}

module.exports = {
    resolveApiResourceProtocol,
};
