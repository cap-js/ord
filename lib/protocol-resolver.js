const cds = require("@sap/cds");

const Logger = require("./logger");
const { isPrimaryDataProductService, isAgentService } = require("./common/utils");
const { CAP_TO_ORD_PROTOCOL_MAP, ORD_ONLY_PROTOCOLS, ORD_API_PROTOCOL } = require("./constants");

// TODO: This is redundant with API resources slug: And I still don't believe in ... sluggification? What is this? 
function _agentSlug(serviceName) {
    return /[^.]+$/
        .exec(serviceName)[0]
        .replace(/Service$/, "")
        .replace(/_/g, "-")
        .replace(/([a-z0-9])([A-Z])/g, (_m, c, C) => c + "-" + C)
        .toLowerCase();
}

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
    // 1. Agent service - early return
    if (isAgentService(srvDefinition)) {
        return [
            {
                entryPoints: [`/a2a/${_agentSlug(srvDefinition.name)}`],
                hasResourceDefinitions: true,
                apiProtocol: ORD_API_PROTOCOL.A2A,
            },
        ];
    }

    // 2. Primary Data Product - early return
    if (isPrimaryDataProductService(srvDefinition)) {
        return [
            {
                entryPoints: [],
                hasResourceDefinitions: true,
                apiProtocol: ORD_API_PROTOCOL.SAP_DATA_SUBSCRIPTION,
            },
        ];
    }

    const ordProtocols = cds.service.protocols
        .endpoints4({ name: srvDefinition.name, definition: srvDefinition })
        .filter((endpoint) => Boolean(CAP_TO_ORD_PROTOCOL_MAP[endpoint.kind]))
        .map((endpoint) => ({
            hasResourceDefinitions: true,
            entryPoints: endpoint.path ? [endpoint.path] : [],
            apiProtocol: CAP_TO_ORD_PROTOCOL_MAP[endpoint.kind],
        }));

    const cdsProtocols = Object.keys(cds.service.protocols.for(srvDefinition));
    for (const protocol of cdsProtocols) {
        // 2. Handle explicit protocol - check if it's an ORD-only protocol (e.g., INA)
        if (ORD_ONLY_PROTOCOLS[protocol]) {
            const { apiProtocol, hasEntryPoints, hasResourceDefinitions } = ORD_ONLY_PROTOCOLS[protocol];
            const path = hasEntryPoints ? cds.service.protocols.path4(srvDefinition) : null;

            ordProtocols.push({
                apiProtocol: apiProtocol,
                entryPoints: path ? [path] : [],
                hasResourceDefinitions: hasResourceDefinitions,
            });
            continue;
        }

        // 3. Handle explicit protocol with no CAP endpoint (Rule A)
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
