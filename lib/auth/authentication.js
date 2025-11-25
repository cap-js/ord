const cds = require("@sap/cds");
const { AUTHENTICATION_TYPE, BASIC_AUTH_HEADER_KEY, AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP } = require("../constants");
const { Logger } = require("../logger");
const bcrypt = require("bcryptjs");
const { createCfMtlsConfig, handleCfMtlsAuthentication } = require("./cf-mtls");

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
 * Lazy-loads and initializes the CF mTLS validator.
 * Uses Promise caching to ensure initialization only happens once even with concurrent requests.
 *
 * @param {Object} authConfig - Authentication configuration object
 * @returns {Promise<Function>} The CF mTLS validator function
 * @throws {Error} If CF mTLS initialization fails
 */
async function ensureCfMtlsValidator(authConfig) {
    // Already initialized
    if (authConfig.cfMtlsValidator) {
        return authConfig.cfMtlsValidator;
    }

    // Initialization in progress - wait for it
    if (authConfig._cfMtlsInitPromise) {
        await authConfig._cfMtlsInitPromise;
        return authConfig.cfMtlsValidator;
    }

    // Start initialization
    Logger.info("Initializing CF mTLS validator (lazy loading)...");

    authConfig._cfMtlsInitPromise = (async () => {
        try {
            const cfMtlsConfig = await createCfMtlsConfig(cds, Logger);

            if (cfMtlsConfig.error) {
                throw new Error(cfMtlsConfig.error);
            }

            authConfig.cfMtlsValidator = cfMtlsConfig.cfMtlsValidator;
            Logger.info("CF mTLS validator initialized successfully");
        } catch (error) {
            // Clean up on failure so retry is possible
            authConfig._cfMtlsInitPromise = null;
            throw error;
        }
    })();

    await authConfig._cfMtlsInitPromise;
    return authConfig.cfMtlsValidator;
}

/**
 * Create authentication configuration based on environment variables or .cdsrc.json settings.
 *
 * Configuration Priority (highest to lowest):
 * 1. Environment variables (ORD_AUTH_TYPE, BASIC_AUTH, CF_MTLS_TRUSTED_CERTS) - for production deployments
 * 2. .cdsrc.json settings (cds.env.authentication, cds.env.ord.cfMtls) - for development and testing
 *
 * This approach follows the 12-Factor App principles where environment variables
 * can override configuration files for deployment flexibility.
 *
 * Note: CF mTLS validator is lazily initialized on first use to avoid blocking
 * service startup for users not using mTLS authentication.
 *
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
            (authConfig.types.includes(AUTHENTICATION_TYPE.Basic) ||
                authConfig.types.includes(AUTHENTICATION_TYPE.CfMtls))
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
            // Mark for lazy initialization - validator will be loaded on first use
            authConfig.cfMtlsValidator = null;
            authConfig._cfMtlsInitPromise = null;
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
 * Supports optional preloading of CF mTLS validator via CF_MTLS_PRELOAD environment variable.
 *
 * @returns {Promise<Object>} Authentication configuration
 */
async function getAuthConfig() {
    if (cds.context?.authConfig) return cds.context?.authConfig;

    const authConfig = createAuthConfig();

    if (authConfig.error) {
        Logger.error("Authentication configuration error: " + authConfig.error);
        throw new Error("Invalid authentication configuration");
    }

    // Optional: Preload CF mTLS validator at startup (controlled by environment variable)
    // This is useful in production to avoid latency on first request
    if (process.env.CF_MTLS_PRELOAD === "true" && authConfig.types.includes(AUTHENTICATION_TYPE.CfMtls)) {
        Logger.info("CF_MTLS_PRELOAD=true: Preloading CF mTLS validator at startup...");
        try {
            await ensureCfMtlsValidator(authConfig);
        } catch (error) {
            Logger.error("Failed to preload CF mTLS validator:", error.message);
            throw new Error("CF mTLS preload failed: " + error.message);
        }
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
        try {
            // Lazy-load validator on first mTLS request
            await ensureCfMtlsValidator(authConfig);

            const result = handleCfMtlsAuthentication(req, res, authConfig, Logger);

            if (result.success) {
                res.status(200);
                return next();
            }

            // Response already sent by handleCfMtlsAuthentication
            return;
        } catch (error) {
            Logger.error("CF mTLS initialization failed:", error.message);
            return res.status(500).send("Authentication configuration error");
        }
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
