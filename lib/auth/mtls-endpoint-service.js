/**
 * mTLS Endpoint Service Module
 *
 * Provides functionality to dynamically fetch trusted certificate information
 * from external configuration endpoints and merge with static configuration.
 */

/* global AbortController */

const { HTTP_CONFIG } = require("../constants");

/**
 * Fetches mTLS certificate information from a single endpoint
 *
 * @param {string} endpoint - URL to fetch certificate info from
 * @param {number} timeoutMs - Request timeout in milliseconds
 * @returns {Promise<{issuer: string, subject: string}>} Certificate information
 * @throws {Error} If fetch fails or response is invalid
 */
async function fetchMtlsCertInfo(endpoint, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(endpoint, {
            method: HTTP_CONFIG.METHOD_GET,
            headers: { Accept: HTTP_CONFIG.CONTENT_TYPE_JSON },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Validate response format (must match provider-server format)
        if (!data.certIssuer || !data.certSubject) {
            throw new Error("Invalid response: missing certIssuer or certSubject");
        }

        return {
            issuer: data.certIssuer,
            subject: data.certSubject,
        };
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
            throw new Error(`Request timeout after ${timeoutMs}ms`);
        }
        throw error;
    }
}

/**
 * Fetches trusted certificates from multiple endpoints in parallel
 *
 * @param {string[]} endpoints - Array of endpoint URLs to fetch from
 * @param {Object} Logger - Logger instance for logging
 * @param {number} [timeoutMs] - Timeout for each request in milliseconds
 * @returns {Promise<{certs: Array<{issuer: string, subject: string}>, rootCaDn: string[]}>}
 */
async function fetchMtlsTrustedCertsFromEndpoints(endpoints, Logger, timeoutMs = HTTP_CONFIG.MTLS_TIMEOUT_MS) {
    if (!endpoints || endpoints.length === 0) {
        return { certs: [], rootCaDn: [] };
    }

    const certPairsMap = new Map();

    const fetchPromises = endpoints.map(async (endpoint) => {
        try {
            const certInfo = await fetchMtlsCertInfo(endpoint, timeoutMs);
            const key = `${certInfo.issuer}|${certInfo.subject}`;
            certPairsMap.set(key, certInfo);
            Logger.info(
                `Successfully fetched mTLS cert info from ${endpoint} - Issuer: ${certInfo.issuer}, Subject: ${certInfo.subject}`,
            );
        } catch (error) {
            Logger.error(`Failed to fetch mTLS cert from ${endpoint}: ${error.message}`);
        }
    });

    await Promise.all(fetchPromises);

    return {
        certs: Array.from(certPairsMap.values()),
        rootCaDn: [], // Root CAs are never fetched from endpoints (security by design)
    };
}

/**
 * Merges certificate configurations from endpoints and static config
 *
 * @param {Object} fromEndpoints - Configuration from endpoints
 * @param {Array<{issuer: string, subject: string}>} fromEndpoints.certs - Certificate pairs from endpoints
 * @param {string[]} fromEndpoints.rootCaDn - Root CA DNs from endpoints (always empty)
 * @param {Object} fromConfig - Static configuration
 * @param {Array<{issuer: string, subject: string}>} fromConfig.certs - Static certificate pairs
 * @param {string[]} fromConfig.rootCaDn - Static root CA DNs
 * @param {Object} Logger - Logger instance
 * @returns {{certs: Array<{issuer: string, subject: string}>, rootCaDn: string[]}}
 */
function mergeTrustedCerts(fromEndpoints, fromConfig, Logger) {
    const { tokenizeDn, dnTokensMatch } = require("./cf-mtls");

    // Merge certificate pairs with deduplication
    const certPairsMap = new Map();

    const allPairs = [...(fromEndpoints.certs || []), ...(fromConfig.certs || [])];

    for (const pair of allPairs) {
        const key = `${pair.issuer}|${pair.subject}`;
        certPairsMap.set(key, pair);
    }

    // Merge root CA DNs with DN-aware deduplication
    const rootCaDns = [];
    const allRootCas = [...(fromEndpoints.rootCaDn || []), ...(fromConfig.rootCaDn || [])];

    for (const dn of allRootCas) {
        const dnTokens = tokenizeDn(dn);
        const isDuplicate = rootCaDns.some((existing) => dnTokensMatch(tokenizeDn(existing), dnTokens));
        if (!isDuplicate) {
            rootCaDns.push(dn);
        }
    }

    const merged = {
        certs: Array.from(certPairsMap.values()),
        rootCaDn: rootCaDns,
    };

    Logger.info(
        `Merged mTLS config: ${merged.certs.length} certificate pair(s), ${merged.rootCaDn.length} root CA DN(s)`,
    );

    return merged;
}

module.exports = {
    fetchMtlsTrustedCertsFromEndpoints,
    mergeTrustedCerts,
};
