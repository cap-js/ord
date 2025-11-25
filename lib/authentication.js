const cds = require("@sap/cds");
const {
    AUTHENTICATION_TYPE,
    BASIC_AUTH_HEADER_KEY,
    AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP,
    CF_MTLS_HEADERS,
} = require("./constants");
const { Logger } = require("./logger");
const bcrypt = require("bcryptjs");
const { createCfMtlsValidator } = require("./cf-mtls");

/**
 * Compares a plain text password with a hashed password
 * @param {string} password Plain text password to check
 * @param {string} hashedPassword Hashed password to compare against
 * @returns {Promise<boolean>} Promise resolving to true if passwords match, false otherwise
 */
async function _comparePassword(password, hashedPassword) {
    if (!password || !hashedPassword) {
        throw new Error("Password and hashed password are required");
    }
    return await bcrypt.compare(password, hashedPassword.replace(/^\$2y/, "$2a"));
}

/**
 * Validates if a string is a bcrypt hash
 * @param {string} hash String to validate
 * @returns {boolean} boolean indicating if the string is a bcrypt hash
 */
function _isBcryptHash(hash) {
    return /^\$2[ayb]\$\d{2}\$[A-Za-z0-9./]{53}$/.test(hash);
}

/**
 * Create authentication configuration based on data given in the environment variables.
 * @returns {Object} Authentication configuration object or default configuration object as a fallback.
 */
function createAuthConfig() {
    const defaultAuthConfig = {
        types: [AUTHENTICATION_TYPE.Open],
        accessStrategies: [{ type: AUTHENTICATION_TYPE.Open }],
    };

    try {
        const authConfig = {};

        authConfig.types = process.env.ORD_AUTH_TYPE
            ? [...new Set(JSON.parse(process.env.ORD_AUTH_TYPE))]
            : [...new Set(cds.env.authentication?.types)];

        if (!authConfig.types || authConfig.types.length === 0) {
            Logger.error("createAuthConfig:", 'No authorization type is provided. Defaulting to "Open" authentication');
            return defaultAuthConfig;
        }

        if (authConfig.types.some((authType) => !Object.values(AUTHENTICATION_TYPE).includes(authType))) {
            return Object.assign(defaultAuthConfig, { error: "Invalid authentication type" });
        }

        if (
            authConfig.types.includes(AUTHENTICATION_TYPE.Open) &&
            authConfig.types.includes(AUTHENTICATION_TYPE.Basic)
        ) {
            return Object.assign(defaultAuthConfig, {
                error: "Open authentication cannot be combined with any other authentication type",
            });
        }

        if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
            const credentials = process.env.BASIC_AUTH
                ? JSON.parse(process.env.BASIC_AUTH)
                : cds.env.authentication.credentials;

            // Check all passwords in credentials map
            for (const [username, password] of Object.entries(credentials)) {
                if (!_isBcryptHash(password)) {
                    Logger.error("createAuthConfig:", `Password for user "${username}" must be a bcrypt hash`);
                    return Object.assign(defaultAuthConfig, { error: "All passwords must be bcrypt hashes" });
                }
            }
            // Store the complete credentials map
            authConfig.credentials = credentials;
        }

        if (authConfig.types.includes(AUTHENTICATION_TYPE.CfMtls)) {
            // Parse trusted certificate pairs
            let trustedCertPairs;

            if (process.env.CF_MTLS_TRUSTED_CERT_PAIRS) {
                try {
                    trustedCertPairs = JSON.parse(process.env.CF_MTLS_TRUSTED_CERT_PAIRS);
                } catch (error) {
                    Logger.error("createAuthConfig:", `Failed to parse CF_MTLS_TRUSTED_CERT_PAIRS: ${error.message}`);
                    return Object.assign(defaultAuthConfig, {
                        error: "Invalid CF_MTLS_TRUSTED_CERT_PAIRS format",
                    });
                }
            } else {
                trustedCertPairs = cds.env.ord?.cfMtls?.trustedCertPairs;
            }

            // Parse trusted root CA DNs
            let trustedRootCaDns;

            if (process.env.CF_MTLS_TRUSTED_ROOT_CA_DNS) {
                try {
                    trustedRootCaDns = JSON.parse(process.env.CF_MTLS_TRUSTED_ROOT_CA_DNS);
                } catch (error) {
                    Logger.error("createAuthConfig:", `Failed to parse CF_MTLS_TRUSTED_ROOT_CA_DNS: ${error.message}`);
                    return Object.assign(defaultAuthConfig, {
                        error: "Invalid CF_MTLS_TRUSTED_ROOT_CA_DNS format",
                    });
                }
            } else {
                trustedRootCaDns = cds.env.ord?.cfMtls?.trustedRootCaDns;
            }

            // Validate configuration
            if (!trustedCertPairs || !Array.isArray(trustedCertPairs) || trustedCertPairs.length === 0) {
                Logger.error(
                    "createAuthConfig:",
                    "CF mTLS requires trustedCertPairs to be configured. " +
                        "Set cds.env.ord.cfMtls.trustedCertPairs or CF_MTLS_TRUSTED_CERT_PAIRS environment variable.",
                );
                return Object.assign(defaultAuthConfig, {
                    error: "CF mTLS requires trustedCertPairs configuration",
                });
            }

            if (!trustedRootCaDns || !Array.isArray(trustedRootCaDns) || trustedRootCaDns.length === 0) {
                Logger.error(
                    "createAuthConfig:",
                    "CF mTLS requires trustedRootCaDns to be configured. " +
                        "Set cds.env.ord.cfMtls.trustedRootCaDns or CF_MTLS_TRUSTED_ROOT_CA_DNS environment variable.",
                );
                return Object.assign(defaultAuthConfig, {
                    error: "CF mTLS requires trustedRootCaDns configuration",
                });
            }

            // Resolve header names (use defaults from CF_MTLS_HEADERS if not specified)
            const headerNames = {
                issuer:
                    process.env.CF_MTLS_HEADER_ISSUER ||
                    cds.env.ord?.cfMtls?.headerNames?.issuer ||
                    CF_MTLS_HEADERS.ISSUER,
                subject:
                    process.env.CF_MTLS_HEADER_SUBJECT ||
                    cds.env.ord?.cfMtls?.headerNames?.subject ||
                    CF_MTLS_HEADERS.SUBJECT,
                rootCa:
                    process.env.CF_MTLS_HEADER_ROOT_CA ||
                    cds.env.ord?.cfMtls?.headerNames?.rootCa ||
                    CF_MTLS_HEADERS.ROOT_CA,
            };

            try {
                // Create the validator function
                authConfig.cfMtlsValidator = createCfMtlsValidator({
                    trustedCertPairs,
                    trustedRootCaDns,
                    headerNames,
                });
            } catch (error) {
                Logger.error("createAuthConfig:", `Failed to create CF mTLS validator: ${error.message}`);
                return Object.assign(defaultAuthConfig, { error: error.message });
            }
        }

        authConfig.accessStrategies = authConfig.types.map((type) => ({
            type: AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP[type],
        }));
        return authConfig;
    } catch (error) {
        return Object.assign(defaultAuthConfig, { error: error.message });
    }
}

/**
 * Validate, store authentication configuration in cds.context if undefined, and return the context.
 */
function getAuthConfig() {
    if (cds.context?.authConfig) return cds.context?.authConfig;

    const authConfig = createAuthConfig();

    if (authConfig.error) {
        Logger.error("Authentication configuration error: " + authConfig.error);
        throw new Error("Invalid authentication configuration");
    }

    // set the context
    cds.context = {
        authConfig,
    };
    return cds.context?.authConfig;
}

/**
 * Middleware to authenticate the request based on the authentication configuration.
 */
async function authenticate(req, res, next) {
    const authConfig = cds.context.authConfig;

    if (authConfig.types.includes(AUTHENTICATION_TYPE.Open)) {
        res.status(200);
        return next();
    }

    // Try Basic authentication if configured and header is present
    if (req.headers[BASIC_AUTH_HEADER_KEY] && authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
        const authHeader = req.headers[BASIC_AUTH_HEADER_KEY];

        if (!authHeader.startsWith("Basic ")) {
            return res.status(401).send("Invalid authentication type");
        }

        const [username, password] = Buffer.from(authHeader.split(" ")[1], "base64").toString().split(":");
        const credentials = authConfig.credentials;
        const storedPassword = credentials[username];

        if (storedPassword && (await _comparePassword(password, storedPassword))) {
            res.status(200);
            return next();
        } else {
            return res.status(401).send("Invalid credentials");
        }
    }

    // Try CF mTLS authentication if configured
    if (authConfig.types.includes(AUTHENTICATION_TYPE.CfMtls)) {
        const result = authConfig.cfMtlsValidator(req);

        if (result.ok) {
            // Attach the validated certificate information to the request for potential use downstream
            req.cfMtlsIssuer = result.issuer;
            req.cfMtlsSubject = result.subject;
            req.cfMtlsRootCaDn = result.rootCaDn;
            res.status(200);
            return next();
        }

        // Handle different failure reasons with appropriate HTTP status codes
        if (result.reason === "NO_HEADERS") {
            // If Basic auth is also configured, provide a more informative message
            if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
                return res
                    .status(401)
                    .setHeader("WWW-Authenticate", 'Basic realm="401"')
                    .send("Authentication required.");
            }
            return res.status(401).send("Client certificate authentication required");
        }

        if (result.reason === "HEADER_MISSING") {
            Logger.error("CF mTLS authentication failed:", `Missing header: ${result.missing}`);
            // If Basic auth is also configured, provide fallback
            if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
                return res
                    .status(401)
                    .setHeader("WWW-Authenticate", 'Basic realm="401"')
                    .send("Authentication required.");
            }
            return res.status(401).send("Client certificate authentication required");
        }

        if (result.reason === "INVALID_ENCODING") {
            Logger.error("CF mTLS authentication failed:", "Invalid certificate header encoding");
            return res.status(400).send("Bad Request: Invalid certificate headers");
        }

        if (result.reason === "CERT_PAIR_MISMATCH") {
            Logger.error(
                "CF mTLS authentication failed:",
                `Certificate pair mismatch. Issuer: ${result.issuer}, Subject: ${result.subject}`,
            );
            return res.status(403).send("Forbidden: Invalid client certificate");
        }

        if (result.reason === "ROOT_CA_MISMATCH") {
            Logger.error("CF mTLS authentication failed:", `Root CA mismatch. Root CA DN: ${result.rootCaDn}`);
            return res.status(403).send("Forbidden: Untrusted certificate authority");
        }

        return res.status(401).send("Client certificate authentication failed");
    }

    // If only Basic auth is configured but no header present
    if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
        return res.status(401).setHeader("WWW-Authenticate", 'Basic realm="401"').send("Authentication required.");
    }

    // In other cases, the request is unauthorized
    return res.status(401).send("Not authorized");
}

module.exports = {
    authenticate,
    createAuthConfig,
    getAuthConfig,
};
