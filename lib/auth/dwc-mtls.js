/**
 * DwC mTLS Subject Validation Module
 *
 * This module provides validation for SAP CloudFoundry mTLS authentication.
 * It validates client certificate issuer, subject DN, and root CA DN from
 * separate HTTP headers that are base64-encoded.
 *
 * IMPORTANT SECURITY CONTEXT:
 * - This module assumes TLS termination and certificate chain validation is handled
 *   by the CloudFoundry gorouter or API Gateway
 * - It ONLY validates the certificate information (issuer, subject, root CA) against
 *   an allow list of trusted certificate pairs and root CAs
 * - It does NOT perform cryptographic validation or certificate chain verification
 *
 * This implementation aligns with the provider-server's DwC mTLS validation approach.
 */

const utils = require("./ssl-utils");
const { DWC_MTLS_HEADERS } = require("../constants");
const { fetchMtlsTrustedCertsFromEndpoints, mergeTrustedCerts } = require("./mtls-endpoint-service");
const { ORD_ACCESS_STRATEGY, MTLS_ERROR_REASON, AUTH_STRINGS } = require("../constants");

/**
 * Extracts and decodes certificate information from base64-encoded DwC header
 *
 * @param {Object} req - Request object with headers property
 * @returns {Object} Certificate information or error
 */
function extractCertHeaders(req) {
    const header = req?.headers?.[DWC_MTLS_HEADERS.DFCC.toLowerCase()];

    if (!header) {
        return { error: MTLS_ERROR_REASON.HEADER_MISSING, missing: DWC_MTLS_HEADERS.DFCC };
    }

    try {
        // Decode base64-encoded mTLS certificate from header
        const chain = utils.unchain(Buffer.from(header, "base64").toString("utf-8"));

        return {
            issuer: utils.issuer(chain.at(0)),
            subject: utils.subject(chain.at(0)),
            rootCaDn: utils.issuer(chain.at(-1)),
        };
    } catch {
        return { error: MTLS_ERROR_REASON.INVALID_ENCODING };
    }
}

/**
 * Creates DwC mTLS configuration from environment variables or CDS settings.
 * Parses and validates the configuration needed for DwC mTLS authentication.
 * Supports dynamic fetching of certificate information from config endpoints.
 *
 * @param {Object} cds - CDS instance with environment configuration
 * @param {Object} Logger - Logger instance for error messages
 * @returns {Promise<Object>} DwC mTLS configuration or error object
 */
async function createDwcMtlsConfig(cds, Logger) {
    // Configuration priority:
    // 1. dwcMtls: true - Production mode, requires DWC_MTLS_TRUSTED_CERTS env var
    // 2. dwcMtls: { ... } - Development mode, uses inline config from .cdsrc.json
    // Note: Environment variable alone is NOT sufficient, explicit .cdsrc.json declaration required

    let config;
    const cdsConfig = cds.env.ord?.authentication?.dwcMtls;

    // dwcMtls must be explicitly configured in .cdsrc.json
    if (!cdsConfig) {
        Logger.error("DwC mTLS configuration required. Set ord.authentication.dwcMtls in .cdsrc.json");
        return {
            error: "DwC mTLS configuration required. Set ord.authentication.dwcMtls in .cdsrc.json",
        };
    }

    // Production: dwcMtls: true → requires DWC_MTLS_TRUSTED_CERTS environment variable
    if (cdsConfig === true) {
        if (!process.env.DWC_MTLS_TRUSTED_CERTS) {
            Logger.error(
                "DwC mTLS enabled with dwcMtls: true but DWC_MTLS_TRUSTED_CERTS environment variable is not set. " +
                    "Set DWC_MTLS_TRUSTED_CERTS with JSON: {certs: [...], rootCaDn: [...]} or {configEndpoints: [...], rootCaDn: [...]}",
            );
            return {
                error: "DWC_MTLS_TRUSTED_CERTS environment variable required when dwcMtls is set to true",
            };
        }
        try {
            config = JSON.parse(process.env.DWC_MTLS_TRUSTED_CERTS);
        } catch {
            Logger.error("Failed to parse DWC_MTLS_TRUSTED_CERTS environment variable");
            return {
                error: "Invalid DWC_MTLS_TRUSTED_CERTS format. Expected JSON: {certs: [...], rootCaDn: [...], configEndpoints: [...]}",
            };
        }
    }
    // Development: dwcMtls: { ... } → use inline config from .cdsrc.json
    else if (typeof cdsConfig === "object") {
        config = cdsConfig;
    }
    // Invalid configuration type
    else {
        Logger.error("Invalid dwcMtls configuration. Expected true or object with certs/rootCaDn/configEndpoints");
        return {
            error: "Invalid dwcMtls configuration. Expected true or object",
        };
    }

    // Extract configuration fields
    let { certs = [], rootCaDn = [], configEndpoints = [] } = config;

    // Validate configuration structure
    if (!Array.isArray(certs)) {
        Logger.error("Invalid configuration: certs must be an array");
        return { error: "Invalid configuration: certs must be an array" };
    }

    if (!Array.isArray(rootCaDn)) {
        Logger.error("Invalid configuration: rootCaDn must be an array");
        return { error: "Invalid configuration: rootCaDn must be an array" };
    }

    if (configEndpoints && !Array.isArray(configEndpoints)) {
        Logger.error("Invalid configuration: configEndpoints must be an array");
        return { error: "Invalid configuration: configEndpoints must be an array" };
    }

    // Fetch from config endpoints if configured
    if (configEndpoints && configEndpoints.length > 0) {
        Logger.info(`Testing UCL connectivity to ${configEndpoints.length} endpoint(s)`);

        try {
            const fromEndpoints = await fetchMtlsTrustedCertsFromEndpoints(configEndpoints, Logger);

            // Strict validation: if configEndpoints are configured, we must get certificates from them
            if (fromEndpoints.certs.length === 0) {
                Logger.error(
                    `UCL connectivity failed: No certificates retrieved from ${configEndpoints.length} endpoint(s)`,
                );
                return {
                    error: `UCL connectivity failed: No certificates retrieved from any endpoint`,
                };
            }

            Logger.info(`✓ UCL connectivity verified: retrieved ${fromEndpoints.certs.length} certificate(s)`);

            const merged = mergeTrustedCerts(
                fromEndpoints,
                {
                    certs,
                    rootCaDn,
                },
                Logger,
            );

            certs = merged.certs;
            rootCaDn = merged.rootCaDn;

            Logger.info(`Configuration merged: ${certs.length} certificate pair(s), ${rootCaDn.length} root CA(s)`);
        } catch {
            Logger.error("UCL connectivity test failed");

            // Fail-fast: if configEndpoints are configured but unreachable, fail immediately
            // This ensures UCL connectivity issues are discovered at startup
            return {
                error: `UCL connectivity failed. Service startup aborted to prevent runtime authentication failures.`,
            };
        }
    }

    // Validate final configuration (after merging static and endpoint-fetched certificates)
    if (certs.length === 0) {
        Logger.error(
            "DwC mTLS requires at least one certificate pair. " +
                "Provide via certs array or configEndpoints in DWC_MTLS_TRUSTED_CERTS or ord.authentication.dwcMtls",
        );
        return {
            error: "DwC mTLS requires at least one certificate pair",
        };
    }

    if (rootCaDn.length === 0) {
        Logger.error(
            "DwC mTLS requires at least one root CA. " +
                "Provide via rootCaDn array in DWC_MTLS_TRUSTED_CERTS or ord.authentication.dwcMtls",
        );
        return {
            error: "DwC mTLS requires at least one root CA",
        };
    }

    try {
        // Create the validator function
        return {
            mtlsValidator: createDwcMtlsValidator({
                trustedCertPairs: certs,
                trustedRootCaDns: rootCaDn,
            }),
        };
    } catch (error) {
        Logger.error("Failed to create DwC mTLS validator");
        return { error: error.message };
    }
}

/**
 * Handles DwC mTLS authentication for a request.
 * This function processes the DwC mTLS authentication and returns appropriate
 * HTTP response actions based on the validation result.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} authConfig - Authentication configuration
 * @param {Function} authConfig.mtlsValidator - DwC mTLS validator function
 * @param {Array<string>} authConfig.accessStrategies - Array of enabled access strategies
 * @param {Object} Logger - Logger instance for error messages
 * @returns {Object} Result object with success flag and optional next() call
 */
function handleDwcMtlsAuthentication(req, res, authConfig, Logger) {
    const result = authConfig.mtlsValidator(req);

    if (result.ok) {
        // Attach the validated certificate information to the request for potential use downstream
        req.mtlsIssuer = result.issuer;
        req.mtlsSubject = result.subject;
        req.mtlsRootCaDn = result.rootCaDn;
        return { success: true };
    }

    // Handle different failure reasons with appropriate HTTP status codes
    if (result.reason === MTLS_ERROR_REASON.XFCC_VERIFICATION_FAILED) {
        Logger.error("DwC mTLS authentication failed: Missing proxy verification");
        // If Basic auth is also configured, provide fallback
        if (authConfig.accessStrategies.includes(ORD_ACCESS_STRATEGY.Basic)) {
            res.status(401)
                .setHeader("WWW-Authenticate", AUTH_STRINGS.WWW_AUTHENTICATE_REALM)
                .send("Authentication required.");
        } else {
            res.status(401).send("Missing proxy verification of mTLS client certificate");
        }
        return { success: false };
    }

    if (result.reason === MTLS_ERROR_REASON.NO_HEADERS) {
        // If Basic auth is also configured, provide a more informative message
        if (authConfig.accessStrategies.includes(ORD_ACCESS_STRATEGY.Basic)) {
            res.status(401)
                .setHeader("WWW-Authenticate", AUTH_STRINGS.WWW_AUTHENTICATE_REALM)
                .send("Authentication required.");
        } else {
            res.status(401).send("Client certificate authentication required");
        }
        return { success: false };
    }

    if (result.reason === MTLS_ERROR_REASON.HEADER_MISSING) {
        Logger.error(`DwC mTLS authentication failed: Missing header ${result.missing}`);
        // If Basic auth is also configured, provide fallback
        if (authConfig.accessStrategies.includes(ORD_ACCESS_STRATEGY.Basic)) {
            res.status(401)
                .setHeader("WWW-Authenticate", AUTH_STRINGS.WWW_AUTHENTICATE_REALM)
                .send("Authentication required.");
        } else {
            res.status(401).send("Client certificate authentication required");
        }
        return { success: false };
    }

    if (result.reason === MTLS_ERROR_REASON.INVALID_ENCODING) {
        Logger.error("DwC mTLS authentication failed: Invalid certificate header encoding");
        res.status(400).send("Bad Request: Invalid certificate headers");
        return { success: false };
    }

    if (result.reason === MTLS_ERROR_REASON.CERT_PAIR_MISMATCH) {
        Logger.error("DwC mTLS authentication failed: Certificate pair not trusted");
        res.status(403).send("Forbidden: Invalid client certificate");
        return { success: false };
    }

    if (result.reason === MTLS_ERROR_REASON.ROOT_CA_MISMATCH) {
        Logger.error("DwC mTLS authentication failed: Root CA not trusted");
        res.status(403).send("Forbidden: Untrusted certificate authority");
        return { success: false };
    }

    res.status(401).send("Client certificate authentication failed");
    return { success: false };
}

/**
 * Creates a validator function that checks whether a request contains
 * valid client certificate information matching the trusted configuration.
 *
 * Validates:
 * 1. Issuer + Subject as a pair (both must match together)
 * 2. Root CA DN (must match one of the trusted root CAs)
 *
 * This is pure Node.js, framework-agnostic. It expects a request object
 * with a headers property.
 *
 * @param {Object} options - Configuration options
 * @param {Array<{issuer: string, subject: string}>} options.trustedCertPairs - Trusted issuer/subject pairs
 * @param {string[]} options.trustedRootCaDns - Trusted root CA DNs
 * @returns {Function} Validator function that accepts a request and returns validation result
 * @throws {Error} If configuration is invalid
 */
function createDwcMtlsValidator({ trustedCertPairs, trustedRootCaDns }) {
    // Validate configuration
    if (!Array.isArray(trustedCertPairs) || trustedCertPairs.length === 0) {
        throw new Error("mTLS validation requires at least one trusted certificate (issuer/subject pair)");
    }

    if (!Array.isArray(trustedRootCaDns) || trustedRootCaDns.length === 0) {
        throw new Error("mTLS validation requires at least one trusted root CA DN");
    }

    // Pre-tokenize trusted configuration for efficiency
    const normalizedPairs = trustedCertPairs.map((pair) => ({
        issuerTokens: utils.tokenizeDn(pair.issuer),
        subjectTokens: utils.tokenizeDn(pair.subject),
    }));

    const normalizedRootCas = trustedRootCaDns.map((dn) => utils.tokenizeDn(dn));

    /**
     * Validates a request for DwC mTLS authentication
     * @param {Object} req - Request object with headers property
     * @returns {Object} Validation result with ok, reason, and optional certificate information
     */
    return function validateRequest(req) {
        // Check XFCC proxy-verified path first
        if (!req?.headers?.[DWC_MTLS_HEADERS.DFCC.toLowerCase()]) {
            return {
                ok: false,
                reason: MTLS_ERROR_REASON.XFCC_VERIFICATION_FAILED,
            };
        }

        // Extract certificate information from headers
        const certInfo = extractCertHeaders(req);

        if (certInfo.error) {
            return {
                ok: false,
                reason: certInfo.error,
                missing: certInfo.missing,
            };
        }

        const { issuer, subject, rootCaDn } = certInfo;

        // Tokenize actual certificate information
        const issuerTokens = utils.tokenizeDn(issuer);
        const subjectTokens = utils.tokenizeDn(subject);
        const rootCaTokens = utils.tokenizeDn(rootCaDn);

        // Validate issuer + subject pair (both must match together)
        const isTrustedPair = normalizedPairs.some(
            (pair) =>
                utils.dnTokensMatch(issuerTokens, pair.issuerTokens) &&
                utils.dnTokensMatch(subjectTokens, pair.subjectTokens),
        );

        if (!isTrustedPair) {
            return {
                ok: false,
                reason: MTLS_ERROR_REASON.CERT_PAIR_MISMATCH,
                issuer,
                subject,
            };
        }

        // Validate root CA DN
        const isTrustedRootCa = normalizedRootCas.some((rootCa) => utils.dnTokensMatch(rootCaTokens, rootCa));

        if (!isTrustedRootCa) {
            return {
                ok: false,
                reason: MTLS_ERROR_REASON.ROOT_CA_MISMATCH,
                rootCaDn,
            };
        }

        return {
            ok: true,
            issuer,
            subject,
            rootCaDn,
        };
    };
}

module.exports = {
    extractCertHeaders,
    createDwcMtlsValidator,
    createDwcMtlsConfig,
    handleDwcMtlsAuthentication,
};
