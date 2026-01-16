/**
 * CF mTLS Subject Validation Module
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
 * This implementation aligns with the provider-server's CF mTLS validation approach.
 */

/**
 * Checks if the request has valid XFCC (X-Forwarded-Client-Cert) headers
 * indicating the proxy has already verified the client certificate.
 *
 * Conditions:
 * - X-Forwarded-Client-Cert header exists
 * - X-Ssl-Client header equals "1"
 * - X-Ssl-Client-Verify header equals "0" (verification success)
 *
 * @param {Object} req - Request object with headers property
 * @returns {boolean} True if XFCC headers indicate proxy verification success
 */
function isXfccProxyVerified(req) {
    const { CF_MTLS_HEADERS } = require("../constants");

    if (!req || !req.headers) {
        return false;
    }

    // Node.js/Express lowercases all header keys
    const xfccKey = CF_MTLS_HEADERS.XFCC.toLowerCase();
    const clientKey = CF_MTLS_HEADERS.CLIENT.toLowerCase();
    const clientVerifyKey = CF_MTLS_HEADERS.CLIENT_VERIFY.toLowerCase();

    const xfcc = req.headers[xfccKey];
    const sslClient = req.headers[clientKey];
    const sslVerify = req.headers[clientVerifyKey];

    // Handle array headers by taking first value
    const sslClientValue = Array.isArray(sslClient) ? sslClient[0] : sslClient;
    const sslVerifyValue = Array.isArray(sslVerify) ? sslVerify[0] : sslVerify;

    return xfcc !== undefined && sslClientValue === "1" && sslVerifyValue === "0";
}

/**
 * Extracts and decodes certificate information from three separate HTTP headers.
 * All headers are expected to be base64-encoded.
 *
 * @param {Object} req - Request object with headers property
 * @param {Object} headerNames - Header names configuration
 * @param {string} headerNames.issuer - Header name for issuer DN
 * @param {string} headerNames.subject - Header name for subject DN
 * @param {string} headerNames.rootCa - Header name for root CA DN
 * @returns {Object} Certificate information or error
 */
function extractCertHeaders(req, headerNames) {
    const { CF_MTLS_ERROR_REASON } = require("../constants");

    if (!req || !req.headers) {
        return { error: CF_MTLS_ERROR_REASON.NO_HEADERS };
    }

    // Node.js/Express lowercases all header keys
    const issuerKey = headerNames.issuer.toLowerCase();
    const subjectKey = headerNames.subject.toLowerCase();
    const rootCaKey = headerNames.rootCa.toLowerCase();

    const issuerHeader = req.headers[issuerKey];
    const subjectHeader = req.headers[subjectKey];
    const rootCaHeader = req.headers[rootCaKey];

    if (!issuerHeader) {
        return { error: CF_MTLS_ERROR_REASON.HEADER_MISSING, missing: headerNames.issuer };
    }
    if (!subjectHeader) {
        return { error: CF_MTLS_ERROR_REASON.HEADER_MISSING, missing: headerNames.subject };
    }
    if (!rootCaHeader) {
        return { error: CF_MTLS_ERROR_REASON.HEADER_MISSING, missing: headerNames.rootCa };
    }

    // Handle array values (take first element)
    const issuerRaw = Array.isArray(issuerHeader) ? issuerHeader[0] : issuerHeader;
    const subjectRaw = Array.isArray(subjectHeader) ? subjectHeader[0] : subjectHeader;
    const rootCaRaw = Array.isArray(rootCaHeader) ? rootCaHeader[0] : rootCaHeader;

    // Decode base64-encoded headers (CF always sends base64-encoded strings)
    try {
        const issuer = Buffer.from(issuerRaw, "base64").toString("utf-8");
        const subject = Buffer.from(subjectRaw, "base64").toString("utf-8");
        const rootCaDn = Buffer.from(rootCaRaw, "base64").toString("utf-8");

        return { issuer, subject, rootCaDn };
    } catch {
        return { error: CF_MTLS_ERROR_REASON.INVALID_ENCODING };
    }
}

/**
 * Tokenizes a Distinguished Name (DN) string into components.
 * Supports both comma-separated and slash-separated formats.
 *
 * Examples:
 *   "CN=test, O=SAP SE, C=DE" (comma-separated)
 *   → ["CN=test", "O=SAP SE", "C=DE"]
 *
 *   "/CN=test/O=SAP SE/C=DE" (slash-separated, e.g., from UCL)
 *   → ["CN=test", "O=SAP SE", "C=DE"]
 *
 * @param {string} dn - DN-style string
 * @returns {string[]} Array of DN tokens
 */
function tokenizeDn(dn) {
    const dnStr = String(dn);
    // Remove leading slash if present
    const cleanDn = dnStr.startsWith("/") ? dnStr.substring(1) : dnStr;
    const separator = dnStr.startsWith("/") ? "/" : ",";

    return cleanDn
        .split(separator)
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
}

/**
 * Compares two arrays of DN tokens in an order-insensitive way.
 * Uses Set-based comparison for efficiency.
 *
 * @param {string[]} tokens1 - First array of DN tokens
 * @param {string[]} tokens2 - Second array of DN tokens
 * @returns {boolean} True if tokens match
 */
function dnTokensMatch(tokens1, tokens2) {
    if (tokens1.length !== tokens2.length) {
        return false;
    }

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    if (set1.size !== set2.size) {
        return false;
    }

    for (const token of set1) {
        if (!set2.has(token)) {
            return false;
        }
    }

    return true;
}

/**
 * Creates CF mTLS configuration from environment variables or CDS settings.
 * Parses and validates the configuration needed for CF mTLS authentication.
 * Supports dynamic fetching of certificate information from config endpoints.
 *
 * @param {Object} cds - CDS instance with environment configuration
 * @param {Object} Logger - Logger instance for error messages
 * @returns {Promise<Object>} CF mTLS configuration or error object
 */
async function createCfMtlsConfig(cds, Logger) {
    const { CF_MTLS_HEADERS } = require("../constants");
    const { fetchMtlsTrustedCertsFromEndpoints, mergeTrustedCerts } = require("./mtls-endpoint-service");

    // Check if running in Cloud Foundry environment
    const cfInstanceGuid = process.env.CF_INSTANCE_GUID;

    if (!cfInstanceGuid || cfInstanceGuid.trim() === "") {
        Logger.error("CF mTLS requires CF_INSTANCE_GUID environment variable");
    }

    // Configuration priority:
    // 1. cfMtls: true - Production mode, requires CF_MTLS_TRUSTED_CERTS env var
    // 2. cfMtls: { ... } - Development mode, uses inline config from .cdsrc.json
    // Note: Environment variable alone is NOT sufficient, explicit .cdsrc.json declaration required

    let config;
    const cdsConfig = cds.env.ord?.authentication?.cfMtls;

    // cfMtls must be explicitly configured in .cdsrc.json
    if (!cdsConfig) {
        Logger.error("CF mTLS configuration required. Set ord.authentication.cfMtls in .cdsrc.json");
        return {
            error: "CF mTLS configuration required. Set ord.authentication.cfMtls in .cdsrc.json",
        };
    }

    // Production: cfMtls: true → requires CF_MTLS_TRUSTED_CERTS environment variable
    if (cdsConfig === true) {
        if (!process.env.CF_MTLS_TRUSTED_CERTS) {
            Logger.error(
                "CF mTLS enabled with cfMtls: true but CF_MTLS_TRUSTED_CERTS environment variable is not set. " +
                    "Set CF_MTLS_TRUSTED_CERTS with JSON: {certs: [...], rootCaDn: [...]} or {configEndpoints: [...], rootCaDn: [...]}",
            );
            return {
                error: "CF_MTLS_TRUSTED_CERTS environment variable required when cfMtls is set to true",
            };
        }
        try {
            config = JSON.parse(process.env.CF_MTLS_TRUSTED_CERTS);
        } catch {
            Logger.error("Failed to parse CF_MTLS_TRUSTED_CERTS environment variable");
            return {
                error: "Invalid CF_MTLS_TRUSTED_CERTS format. Expected JSON: {certs: [...], rootCaDn: [...], configEndpoints: [...]}",
            };
        }
    }
    // Development: cfMtls: { ... } → use inline config from .cdsrc.json
    else if (typeof cdsConfig === "object") {
        config = cdsConfig;
    }
    // Invalid configuration type
    else {
        Logger.error("Invalid cfMtls configuration. Expected true or object with certs/rootCaDn/configEndpoints");
        return {
            error: "Invalid cfMtls configuration. Expected true or object",
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
            "CF mTLS requires at least one certificate pair. " +
                "Provide via certs array or configEndpoints in CF_MTLS_TRUSTED_CERTS or ord.authentication.cfMtls",
        );
        return {
            error: "CF mTLS requires at least one certificate pair",
        };
    }

    if (rootCaDn.length === 0) {
        Logger.error(
            "CF mTLS requires at least one root CA. " +
                "Provide via rootCaDn array in CF_MTLS_TRUSTED_CERTS or ord.authentication.cfMtls",
        );
        return {
            error: "CF mTLS requires at least one root CA",
        };
    }

    // Use fixed header names from constants (not configurable)
    const headerNames = {
        issuer: CF_MTLS_HEADERS.ISSUER,
        subject: CF_MTLS_HEADERS.SUBJECT,
        rootCa: CF_MTLS_HEADERS.ROOT_CA,
    };

    try {
        // Create the validator function
        const cfMtlsValidator = createCfMtlsValidator({
            trustedCertPairs: certs,
            trustedRootCaDns: rootCaDn,
            headerNames,
        });

        return { cfMtlsValidator };
    } catch (error) {
        Logger.error("Failed to create CF mTLS validator");
        return { error: error.message };
    }
}

/**
 * Handles CF mTLS authentication for a request.
 * This function processes the CF mTLS authentication and returns appropriate
 * HTTP response actions based on the validation result.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} authConfig - Authentication configuration
 * @param {Function} authConfig.cfMtlsValidator - CF mTLS validator function
 * @param {Array} authConfig.types - Array of enabled authentication types
 * @param {Object} Logger - Logger instance for error messages
 * @returns {Object} Result object with success flag and optional next() call
 */
function handleCfMtlsAuthentication(req, res, authConfig, Logger) {
    const { AUTHENTICATION_TYPE, CF_MTLS_ERROR_REASON, AUTH_STRINGS } = require("../constants");
    const result = authConfig.cfMtlsValidator(req);

    if (result.ok) {
        // Attach the validated certificate information to the request for potential use downstream
        req.cfMtlsIssuer = result.issuer;
        req.cfMtlsSubject = result.subject;
        req.cfMtlsRootCaDn = result.rootCaDn;
        return { success: true };
    }

    // Handle different failure reasons with appropriate HTTP status codes
    if (result.reason === CF_MTLS_ERROR_REASON.XFCC_VERIFICATION_FAILED) {
        Logger.error("CF mTLS authentication failed: Missing proxy verification");
        // If Basic auth is also configured, provide fallback
        if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
            res.status(401)
                .setHeader("WWW-Authenticate", AUTH_STRINGS.WWW_AUTHENTICATE_REALM)
                .send("Authentication required.");
        } else {
            res.status(401).send("Missing proxy verification of mTLS client certificate");
        }
        return { success: false };
    }

    if (result.reason === CF_MTLS_ERROR_REASON.NO_HEADERS) {
        // If Basic auth is also configured, provide a more informative message
        if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
            res.status(401)
                .setHeader("WWW-Authenticate", AUTH_STRINGS.WWW_AUTHENTICATE_REALM)
                .send("Authentication required.");
        } else {
            res.status(401).send("Client certificate authentication required");
        }
        return { success: false };
    }

    if (result.reason === CF_MTLS_ERROR_REASON.HEADER_MISSING) {
        Logger.error(`CF mTLS authentication failed: Missing header ${result.missing}`);
        // If Basic auth is also configured, provide fallback
        if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
            res.status(401)
                .setHeader("WWW-Authenticate", AUTH_STRINGS.WWW_AUTHENTICATE_REALM)
                .send("Authentication required.");
        } else {
            res.status(401).send("Client certificate authentication required");
        }
        return { success: false };
    }

    if (result.reason === CF_MTLS_ERROR_REASON.INVALID_ENCODING) {
        Logger.error("CF mTLS authentication failed: Invalid certificate header encoding");
        res.status(400).send("Bad Request: Invalid certificate headers");
        return { success: false };
    }

    if (result.reason === CF_MTLS_ERROR_REASON.CERT_PAIR_MISMATCH) {
        Logger.error("CF mTLS authentication failed: Certificate pair not trusted");
        res.status(403).send("Forbidden: Invalid client certificate");
        return { success: false };
    }

    if (result.reason === CF_MTLS_ERROR_REASON.ROOT_CA_MISMATCH) {
        Logger.error("CF mTLS authentication failed: Root CA not trusted");
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
 * @param {Object} options.headerNames - Header names configuration
 * @param {string} options.headerNames.issuer - Header name for issuer DN
 * @param {string} options.headerNames.subject - Header name for subject DN
 * @param {string} options.headerNames.rootCa - Header name for root CA DN
 * @returns {Function} Validator function that accepts a request and returns validation result
 * @throws {Error} If configuration is invalid
 */
function createCfMtlsValidator({ trustedCertPairs, trustedRootCaDns, headerNames }) {
    // Validate configuration
    if (!Array.isArray(trustedCertPairs) || trustedCertPairs.length === 0) {
        throw new Error("mTLS validation requires at least one trusted certificate (issuer/subject pair)");
    }

    if (!Array.isArray(trustedRootCaDns) || trustedRootCaDns.length === 0) {
        throw new Error("mTLS validation requires at least one trusted root CA DN");
    }

    if (!headerNames || !headerNames.issuer || !headerNames.subject || !headerNames.rootCa) {
        throw new Error("headerNames must specify issuer, subject, and rootCa");
    }

    // Pre-tokenize trusted configuration for efficiency
    const normalizedPairs = trustedCertPairs.map((pair) => ({
        issuerTokens: tokenizeDn(pair.issuer),
        subjectTokens: tokenizeDn(pair.subject),
    }));

    const normalizedRootCas = trustedRootCaDns.map((dn) => tokenizeDn(dn));

    /**
     * Validates a request for CF mTLS authentication
     * @param {Object} req - Request object with headers property
     * @returns {Object} Validation result with ok, reason, and optional certificate information
     */
    return function validateRequest(req) {
        const { CF_MTLS_ERROR_REASON } = require("../constants");

        // Check XFCC proxy-verified path first
        if (!isXfccProxyVerified(req)) {
            return {
                ok: false,
                reason: CF_MTLS_ERROR_REASON.XFCC_VERIFICATION_FAILED,
            };
        }

        // Extract certificate information from headers
        const certInfo = extractCertHeaders(req, headerNames);

        if (certInfo.error) {
            return {
                ok: false,
                reason: certInfo.error,
                missing: certInfo.missing,
            };
        }

        const { issuer, subject, rootCaDn } = certInfo;

        // Tokenize actual certificate information
        const issuerTokens = tokenizeDn(issuer);
        const subjectTokens = tokenizeDn(subject);
        const rootCaTokens = tokenizeDn(rootCaDn);

        // Validate issuer + subject pair (both must match together)
        const isTrustedPair = normalizedPairs.some(
            (pair) =>
                dnTokensMatch(issuerTokens, pair.issuerTokens) && dnTokensMatch(subjectTokens, pair.subjectTokens),
        );

        if (!isTrustedPair) {
            return {
                ok: false,
                reason: CF_MTLS_ERROR_REASON.CERT_PAIR_MISMATCH,
                issuer,
                subject,
            };
        }

        // Validate root CA DN
        const isTrustedRootCa = normalizedRootCas.some((rootCa) => dnTokensMatch(rootCaTokens, rootCa));

        if (!isTrustedRootCa) {
            return {
                ok: false,
                reason: CF_MTLS_ERROR_REASON.ROOT_CA_MISMATCH,
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
    isXfccProxyVerified,
    extractCertHeaders,
    tokenizeDn,
    dnTokensMatch,
    createCfMtlsValidator,
    createCfMtlsConfig,
    handleCfMtlsAuthentication,
};
