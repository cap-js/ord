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
    if (!req || !req.headers) {
        return { error: "NO_HEADERS" };
    }

    // Node.js/Express lowercases all header keys
    const issuerKey = headerNames.issuer.toLowerCase();
    const subjectKey = headerNames.subject.toLowerCase();
    const rootCaKey = headerNames.rootCa.toLowerCase();

    const issuerHeader = req.headers[issuerKey];
    const subjectHeader = req.headers[subjectKey];
    const rootCaHeader = req.headers[rootCaKey];

    if (!issuerHeader) {
        return { error: "HEADER_MISSING", missing: headerNames.issuer };
    }
    if (!subjectHeader) {
        return { error: "HEADER_MISSING", missing: headerNames.subject };
    }
    if (!rootCaHeader) {
        return { error: "HEADER_MISSING", missing: headerNames.rootCa };
    }

    // Handle array values (take first element)
    const issuerRaw = Array.isArray(issuerHeader) ? issuerHeader[0] : issuerHeader;
    const subjectRaw = Array.isArray(subjectHeader) ? subjectHeader[0] : subjectHeader;
    const rootCaRaw = Array.isArray(rootCaHeader) ? rootCaHeader[0] : rootCaHeader;

    // Validate base64 encoding with regex
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(issuerRaw) || !base64Regex.test(subjectRaw) || !base64Regex.test(rootCaRaw)) {
        return { error: "INVALID_ENCODING" };
    }

    // Decode base64-encoded headers
    try {
        const issuer = Buffer.from(issuerRaw, "base64").toString("utf-8");
        const subject = Buffer.from(subjectRaw, "base64").toString("utf-8");
        const rootCaDn = Buffer.from(rootCaRaw, "base64").toString("utf-8");

        return { issuer, subject, rootCaDn };
    } catch {
        return { error: "INVALID_ENCODING" };
    }
}

/**
 * Tokenizes a Distinguished Name (DN) string into components.
 * Splits by comma and trims whitespace from each token.
 *
 * Example:
 *   "CN=test, O=SAP SE, C=DE"
 *   → ["CN=test", "O=SAP SE", "C=DE"]
 *
 * @param {string} dn - DN-style string
 * @returns {string[]} Array of DN tokens
 */
function tokenizeDn(dn) {
    return String(dn)
        .split(",")
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

    // Parse configuration from single JSON environment variable or CDS settings
    let config;
    
    if (process.env.CF_MTLS_TRUSTED_CERTS) {
        try {
            config = JSON.parse(process.env.CF_MTLS_TRUSTED_CERTS);
        } catch (error) {
            Logger.error("createCfMtlsConfig:", `Failed to parse CF_MTLS_TRUSTED_CERTS: ${error.message}`);
            return {
                error: "Invalid CF_MTLS_TRUSTED_CERTS format. Expected JSON: {certs: [...], rootCaDn: [...], configEndpoints: [...]}",
            };
        }
    } else {
        config = cds.env.ord?.cfMtls;
    }

    if (!config) {
        Logger.error(
            "createCfMtlsConfig:",
            "CF mTLS configuration required. Set CF_MTLS_TRUSTED_CERTS environment variable or cds.env.ord.cfMtls",
        );
        return {
            error: "CF mTLS configuration required",
        };
    }

    // Extract configuration fields
    let { certs = [], rootCaDn = [], configEndpoints = [] } = config;

    // Validate configuration structure
    if (!Array.isArray(certs)) {
        Logger.error("createCfMtlsConfig:", "certs must be an array");
        return { error: "Invalid configuration: certs must be an array" };
    }

    if (!Array.isArray(rootCaDn)) {
        Logger.error("createCfMtlsConfig:", "rootCaDn must be an array");
        return { error: "Invalid configuration: rootCaDn must be an array" };
    }

    if (configEndpoints && !Array.isArray(configEndpoints)) {
        Logger.error("createCfMtlsConfig:", "configEndpoints must be an array");
        return { error: "Invalid configuration: configEndpoints must be an array" };
    }

    // Fetch from config endpoints if configured
    if (configEndpoints && configEndpoints.length > 0) {
        Logger.info(`Fetching mTLS trusted certificates from ${configEndpoints.length} endpoint(s)...`);

        try {
            const fromEndpoints = await fetchMtlsTrustedCertsFromEndpoints(configEndpoints, Logger);

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

            Logger.info(
                `Loaded ${certs.length} trusted certificate pair(s) and ${rootCaDn.length} trusted root CA DN(s)`,
            );
        } catch (error) {
            Logger.error("createCfMtlsConfig:", `Failed to fetch from endpoints: ${error.message}`);
            // Continue with static config if endpoint fetch fails
            if (certs.length === 0 && rootCaDn.length === 0) {
                return {
                    error: "Failed to fetch certificates from endpoints and no static configuration available",
                };
            }
        }
    }

    // Validate final configuration
    if (!certs || certs.length === 0) {
        Logger.error(
            "createCfMtlsConfig:",
            "CF mTLS requires at least one certificate pair. " +
                "Provide via certs array or configEndpoints in CF_MTLS_TRUSTED_CERTS or cds.env.ord.cfMtls",
        );
        return {
            error: "CF mTLS requires at least one certificate pair",
        };
    }

    if (!rootCaDn || rootCaDn.length === 0) {
        Logger.error(
            "createCfMtlsConfig:",
            "CF mTLS requires at least one root CA DN. " +
                "Provide via rootCaDn array in CF_MTLS_TRUSTED_CERTS or cds.env.ord.cfMtls",
        );
        return {
            error: "CF mTLS requires at least one root CA DN",
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
        Logger.error("createCfMtlsConfig:", `Failed to create CF mTLS validator: ${error.message}`);
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
    const { AUTHENTICATION_TYPE } = require("../constants");
    const result = authConfig.cfMtlsValidator(req);

    if (result.ok) {
        // Attach the validated certificate information to the request for potential use downstream
        req.cfMtlsIssuer = result.issuer;
        req.cfMtlsSubject = result.subject;
        req.cfMtlsRootCaDn = result.rootCaDn;
        return { success: true };
    }

    // Handle different failure reasons with appropriate HTTP status codes
    if (result.reason === "NO_HEADERS") {
        // If Basic auth is also configured, provide a more informative message
        if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
            res.status(401).setHeader("WWW-Authenticate", 'Basic realm="401"').send("Authentication required.");
        } else {
            res.status(401).send("Client certificate authentication required");
        }
        return { success: false };
    }

    if (result.reason === "HEADER_MISSING") {
        Logger.error("CF mTLS authentication failed:", `Missing header: ${result.missing}`);
        // If Basic auth is also configured, provide fallback
        if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
            res.status(401).setHeader("WWW-Authenticate", 'Basic realm="401"').send("Authentication required.");
        } else {
            res.status(401).send("Client certificate authentication required");
        }
        return { success: false };
    }

    if (result.reason === "INVALID_ENCODING") {
        Logger.error("CF mTLS authentication failed:", "Invalid certificate header encoding");
        res.status(400).send("Bad Request: Invalid certificate headers");
        return { success: false };
    }

    if (result.reason === "CERT_PAIR_MISMATCH") {
        Logger.error(
            "CF mTLS authentication failed:",
            `Certificate pair mismatch. Issuer: ${result.issuer}, Subject: ${result.subject}`,
        );
        res.status(403).send("Forbidden: Invalid client certificate");
        return { success: false };
    }

    if (result.reason === "ROOT_CA_MISMATCH") {
        Logger.error("CF mTLS authentication failed:", `Root CA mismatch. Root CA DN: ${result.rootCaDn}`);
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
                reason: "CERT_PAIR_MISMATCH",
                issuer,
                subject,
            };
        }

        // Validate root CA DN
        const isTrustedRootCa = normalizedRootCas.some((rootCa) => dnTokensMatch(rootCaTokens, rootCa));

        if (!isTrustedRootCa) {
            return {
                ok: false,
                reason: "ROOT_CA_MISMATCH",
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
    tokenizeDn,
    dnTokensMatch,
    createCfMtlsValidator,
    createCfMtlsConfig,
    handleCfMtlsAuthentication,
};
