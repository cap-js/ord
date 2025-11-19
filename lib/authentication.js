const cds = require("@sap/cds");
const { AUTHENTICATION_TYPE, BASIC_AUTH_HEADER_KEY, AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP } = require("./constants");
const { Logger } = require("./logger");
const bcrypt = require("bcryptjs");
const { createUclMtlsValidator } = require("./ucl-mtls");

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

        if (authConfig.types.includes(AUTHENTICATION_TYPE.UclMtls)) {
            // Resolve header name from environment, cds.env, or use default
            const headerName =
                process.env.ORD_UCL_MTLS_SUBJECT_HEADER ||
                cds.env.security?.authentication?.clientCertificateHeader ||
                "x-forwarded-client-cert";

            // Resolve expected subjects from cds.env or environment variable
            let expectedSubjects = cds.env.ord?.uclMtls?.expectedSubjects;

            // If not in cds.env, try environment variable
            if (!expectedSubjects && process.env.ORD_UCL_MTLS_EXPECTED_SUBJECTS) {
                // Parse comma-separated list of DN subjects
                // DNs contain commas with spaces (e.g., "CN=foo, O=bar"), so we need to split carefully
                // We split on commas that are NOT followed by a space (which indicates a new DN)
                // Example: "CN=a, O=b, C=c,CN=d, O=e, C=f" -> ["CN=a, O=b, C=c", "CN=d, O=e, C=f"]
                const envValue = process.env.ORD_UCL_MTLS_EXPECTED_SUBJECTS;

                expectedSubjects = envValue.split(/,(?! )/).map((s) => s.trim()).filter(Boolean);
            }

            // Validate that we have at least one expected subject
            if (!expectedSubjects || !Array.isArray(expectedSubjects) || expectedSubjects.length === 0) {
                Logger.error(
                    "createAuthConfig:",
                    "UCL mTLS requires expectedSubjects to be configured. " +
                        "Set cds.env.ord.uclMtls.expectedSubjects or ORD_UCL_MTLS_EXPECTED_SUBJECTS environment variable.",
                );
                return Object.assign(defaultAuthConfig, { error: "UCL mTLS requires expectedSubjects configuration" });
            }

            try {
                // Create the validator function
                authConfig.uclMtlsValidator = createUclMtlsValidator({
                    expectedSubjects,
                    headerName,
                });
                authConfig.uclMtlsHeaderName = headerName;
            } catch (error) {
                Logger.error("createAuthConfig:", `Failed to create UCL mTLS validator: ${error.message}`);
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

    // Try UCL mTLS authentication if configured
    if (authConfig.types.includes(AUTHENTICATION_TYPE.UclMtls)) {
        const result = authConfig.uclMtlsValidator(req);

        if (result.ok) {
            // Attach the validated subject to the request for potential use downstream
            req.uclMtlsSubject = result.subject;
            res.status(200);
            return next();
        }

        // Handle different failure reasons with appropriate HTTP status codes
        if (result.reason === "HEADER_MISSING" || result.reason === "SUBJECT_MISSING" || result.reason === "NO_HEADERS") {
            // If Basic auth is also configured, provide a more informative message
            if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
                return res.status(401).setHeader("WWW-Authenticate", 'Basic realm="401"').send("Authentication required.");
            }
            return res.status(401).send("Client certificate authentication required");
        }

        if (result.reason === "SUBJECT_MISMATCH") {
            Logger.error("UCL mTLS authentication failed:", `Subject mismatch. Received: ${result.subject}`);
            return res.status(403).send("Forbidden: Invalid client certificate");
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
