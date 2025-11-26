/**
 * Authentication Middleware Module
 *
 * This module implements an Express-like middleware pattern for handling multiple
 * authentication strategies. It supports:
 *
 * 1. Strategy Registration: Authentication methods are registered as strategies
 * 2. Multiple Authentication: Basic, CF mTLS, and other methods can coexist
 * 3. Request Routing: Automatically detects request type and routes to appropriate strategy
 * 4. Auto-filtering: When non-open strategies exist, open is automatically ignored
 *
 * Architecture:
 * - Each strategy is a function that returns { success, handled, error }
 * - Strategies are tried in order until one succeeds
 * - Similar to Express middleware chain behavior
 *
 * Supported Authentication Types:
 * - open: No authentication (filtered when combined with secure methods)
 * - basic: HTTP Basic Authentication with bcrypt password hashing
 * - cf-mtls: Cloud Foundry mTLS authentication
 *
 * @module lib/auth/authentication
 */

const cds = require("@sap/cds");
const {
    AUTHENTICATION_TYPE,
    BASIC_AUTH_HEADER_KEY,
    AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP,
    AUTH_STRINGS,
    CF_MTLS_HEADERS,
} = require("../constants");
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

        // When non-open strategies exist, automatically ignore open strategy
        const hasSecureAuth = authConfig.types.some((type) => type !== AUTHENTICATION_TYPE.Open);
        if (hasSecureAuth && authConfig.types.includes(AUTHENTICATION_TYPE.Open)) {
            Logger.info("createAuthConfig:", "Non-open authentication detected. Open authentication will be ignored.");
            authConfig.types = authConfig.types.filter((type) => type !== AUTHENTICATION_TYPE.Open);
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
 * Authentication strategy handler for Basic authentication
 */
async function basicAuthStrategy(req, res, authConfig) {
    const authHeader = req.headers[BASIC_AUTH_HEADER_KEY];

    if (!authHeader) {
        return { success: false, handled: false };
    }

    // Check if this is a Basic auth request
    if (!authHeader.startsWith(AUTH_STRINGS.BASIC_PREFIX)) {
        // Header exists but not Basic auth - this is an explicit rejection
        return { success: false, handled: true, error: "Invalid authentication type" };
    }

    try {
        const [username, password] = Buffer.from(authHeader.split(" ")[1], "base64").toString().split(":");
        const credentials = authConfig.credentials;
        const storedPassword = credentials[username];

        if (storedPassword && (await _comparePassword(password, storedPassword))) {
            return { success: true, handled: true };
        }

        return { success: false, handled: true, error: "Invalid credentials" };
    } catch (error) {
        Logger.error("Basic auth error:", error.message);
        return { success: false, handled: true, error: "Invalid authentication format" };
    }
}

/**
 * Authentication strategy handler for CF mTLS authentication
 */
async function cfMtlsAuthStrategy(req, res, authConfig) {
    // Check if request has mTLS indicators
    const hasMtlsHeaders = Object.values(CF_MTLS_HEADERS).some((header) => req.headers[header.toLowerCase()]);

    if (!hasMtlsHeaders) {
        return { success: false, handled: false };
    }

    try {
        // Lazy-load validator on first mTLS request
        await ensureCfMtlsValidator(authConfig);

        // Create a mock res object to capture response sending attempts
        let capturedStatus = null;
        let capturedMessage = null;
        const mockRes = {
            status: (code) => {
                capturedStatus = code;
                return mockRes;
            },
            setHeader: () => mockRes,
            send: (msg) => {
                capturedMessage = msg;
                return mockRes;
            },
        };

        const result = handleCfMtlsAuthentication(req, mockRes, authConfig, Logger);

        // If handleCfMtlsAuthentication sent a response, we need to send it
        if (!result.success && capturedStatus && capturedMessage) {
            res.status(capturedStatus).send(capturedMessage);
            return { success: false, handled: true, responseSent: true };
        }

        return { success: result.success, handled: true };
    } catch (error) {
        Logger.error("CF mTLS initialization failed:", error.message);
        return { success: false, handled: true, error: "Authentication configuration error" };
    }
}

/**
 * Authentication strategy handler for Open authentication
 */
async function openAuthStrategy() {
    return { success: true, handled: true };
}

/**
 * Strategy registry mapping authentication types to their handlers
 */
const AUTH_STRATEGIES = {
    [AUTHENTICATION_TYPE.Basic]: basicAuthStrategy,
    [AUTHENTICATION_TYPE.CfMtls]: cfMtlsAuthStrategy,
    [AUTHENTICATION_TYPE.Open]: openAuthStrategy,
};

/**
 * Middleware to authenticate the request based on the authentication configuration.
 * Implements Express-like middleware pattern with strategy registration.
 * Tries each configured authentication strategy until one succeeds.
 */
async function authenticate(req, res, next) {
    const authConfig = cds.context.authConfig;

    // Handle invalid configuration
    if (!authConfig || !authConfig.types || !Array.isArray(authConfig.types)) {
        Logger.error("Invalid auth configuration:", authConfig);
        return res.status(401).send("Not authorized");
    }

    // If open authentication, allow immediately
    if (authConfig.types.includes(AUTHENTICATION_TYPE.Open)) {
        res.status(200);
        return next();
    }

    // Try each registered authentication strategy
    const results = [];
    let authSucceeded = false;

    for (const authType of authConfig.types) {
        const strategy = AUTH_STRATEGIES[authType];

        if (!strategy) {
            Logger.warn(`Unknown authentication type: ${authType}`);
            continue;
        }

        try {
            const result = await strategy(req, res, authConfig);
            results.push({ type: authType, ...result });

            if (result.success) {
                authSucceeded = true;
                res.status(200);
                return next();
            }

            // If the strategy already sent a response (e.g., CF mTLS specific error codes)
            if (result.responseSent) {
                return;
            }
        } catch (error) {
            Logger.error(`Error in ${authType} authentication:`, error.message);
            results.push({ type: authType, success: false, handled: true, error: error.message });
        }
    }

    // If we reach here, authentication failed
    // Check if any strategy was attempted
    const attemptedStrategies = results.filter((r) => r.handled);

    if (attemptedStrategies.length === 0) {
        // No authentication method was attempted
        const authMethods = authConfig.types.join(", ");
        const wwwAuthHeaders = [];

        if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
            wwwAuthHeaders.push(AUTH_STRINGS.WWW_AUTHENTICATE_REALM);
        }

        if (wwwAuthHeaders.length > 0) {
            res.setHeader("WWW-Authenticate", wwwAuthHeaders.join(", "));
        }

        return res.status(401).send("Authentication required.");
    }

    // At least one strategy was attempted but failed
    const firstError = attemptedStrategies.find((r) => r.error);
    return res.status(401).send(firstError?.error || "Authentication failed");
}

module.exports = {
    authenticate,
    createAuthConfig,
    getAuthConfig,
};
