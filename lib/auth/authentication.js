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
    ORD_ACCESS_STRATEGY,
    BASIC_AUTH_HEADER_KEY,
    AUTH_STRINGS,
    CF_MTLS_HEADERS,
} = require("../constants");
const Logger = require("../logger");
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
 * Phase 1: Detect authentication configuration from environment variables or .cdsrc.json settings.
 * This function only reads configuration and generates access strategies without initializing runtime components.
 * Used by both build-time and runtime processes.
 *
 * Configuration Priority (highest to lowest):
 * 1. Environment variables (BASIC_AUTH, CF_MTLS_TRUSTED_CERTS) - for production deployments
 * 2. .cdsrc.json settings (cds.env.ord.authentication.basic, cds.env.ord.authentication.cfMtls) - for development and testing
 *
 * Authentication types are automatically detected based on the presence of configuration:
 * - If cds.env.ord.authentication.basic exists → Basic authentication enabled
 * - If cds.env.ord.authentication.cfMtls exists → CF mTLS authentication enabled
 * - Multiple authentication types can coexist and are tried in order
 * - Open authentication is the default when no secure authentication is configured
 *
 * @returns {Object} Authentication configuration object with accessStrategies and detection flags
 */
function detectAuthConfig() {
    const defaultAuthConfig = {
        accessStrategies: [{ type: AUTHENTICATION_TYPE.Open }],
        hasBasic: false,
        hasCfMtls: false,
    };

    try {
        const authConfig = {
            accessStrategies: [],
            hasBasic: false,
            hasCfMtls: false,
        };

        const ordAuth = cds.env.ord?.authentication || {};

        // Detect Basic authentication by checking for credentials
        if (process.env.BASIC_AUTH || ordAuth.basic) {
            const credentials = process.env.BASIC_AUTH
                ? JSON.parse(process.env.BASIC_AUTH)
                : ordAuth.basic?.credentials;

            if (!credentials) {
                Logger.error("detectAuthConfig:", "Basic auth enabled but no credentials provided");
                return Object.assign(defaultAuthConfig, { error: "Basic auth credentials not provided" });
            }

            // Check all passwords in credentials map
            for (const [username, password] of Object.entries(credentials)) {
                if (!_isBcryptHash(password)) {
                    Logger.error("detectAuthConfig:", `Password for user "${username}" must be a bcrypt hash`);
                    return Object.assign(defaultAuthConfig, { error: "All passwords must be bcrypt hashes" });
                }
            }

            authConfig.accessStrategies.push({ type: ORD_ACCESS_STRATEGY.Basic });
            authConfig.hasBasic = true;
            authConfig.credentials = credentials;
        }

        // Detect CF mTLS authentication by checking for cfMtls config
        if (process.env.CF_MTLS_TRUSTED_CERTS || ordAuth.cfMtls) {
            authConfig.accessStrategies.push({ type: ORD_ACCESS_STRATEGY.CfMtls });
            authConfig.hasCfMtls = true;
        }

        // If no authentication strategies detected, default to Open
        if (authConfig.accessStrategies.length === 0) {
            Logger.info("detectAuthConfig:", 'No authentication configured. Defaulting to "Open" authentication');
            return defaultAuthConfig;
        }

        // Use the access strategies directly - no need for additional mapping
        // since we're building them directly in the correct ORD format
        const strategyTypes = authConfig.accessStrategies.map((s) => s.type).join(", ");
        Logger.info("detectAuthConfig:", `Detected authentication strategies: ${strategyTypes}`);
        return authConfig;
    } catch (error) {
        Logger.error("detectAuthConfig:", `Configuration error: ${error.message}`);
        return Object.assign(defaultAuthConfig, { error: error.message });
    }
}

/**
 * Phase 2: Initialize runtime authentication components based on detected configuration.
 * This function initializes validators, network connections, and other runtime-only components.
 * Only used by runtime processes, not during build.
 *
 * @param {Object} baseConfig - Configuration object from detectAuthConfig()
 * @returns {Promise<Object>} Fully initialized authentication configuration
 */
async function initializeRuntimeAuth(baseConfig) {
    const runtimeConfig = { ...baseConfig };

    try {
        // Initialize CF mTLS validator if needed
        if (baseConfig.hasCfMtls) {
            Logger.info("initializeRuntimeAuth:", "Initializing CF mTLS validator...");
            const cfMtlsConfig = await createCfMtlsConfig(cds, Logger);

            if (cfMtlsConfig.error) {
                Logger.error("initializeRuntimeAuth:", `CF mTLS initialization failed: ${cfMtlsConfig.error}`);
                return Object.assign(baseConfig, {
                    error: `CF mTLS configuration error: ${cfMtlsConfig.error}`,
                });
            }

            // Store the validator in the auth config
            runtimeConfig.cfMtlsValidator = cfMtlsConfig.cfMtlsValidator;
            Logger.info("initializeRuntimeAuth:", "CF mTLS validator initialized successfully");
        }

        Logger.info("initializeRuntimeAuth:", "Runtime authentication initialization completed");
        return runtimeConfig;
    } catch (error) {
        Logger.error("initializeRuntimeAuth:", `Runtime initialization error: ${error.message}`);
        return Object.assign(baseConfig, { error: error.message });
    }
}

/**
 * Create complete authentication configuration for runtime use.
 * Combines configuration detection and runtime initialization.
 *
 * @returns {Promise<Object>} Fully initialized authentication configuration
 */
async function createAuthConfig() {
    const baseConfig = detectAuthConfig();

    if (baseConfig.error) {
        return baseConfig;
    }

    return await initializeRuntimeAuth(baseConfig);
}

// Module-level cache for authentication configuration
let cachedAuthConfig = null;
let authConfigPromise = null;

/**
 * Get authentication configuration asynchronously.
 * Uses module-level caching instead of cds.context for better reliability.
 * CF mTLS validator is initialized during configuration creation.
 *
 * @returns {Promise<Object>} Authentication configuration
 */
async function getAuthConfig() {
    if (cachedAuthConfig) {
        return cachedAuthConfig;
    }

    // If already initializing, return the same promise
    if (authConfigPromise) {
        return authConfigPromise;
    }

    // Create and cache the configuration
    authConfigPromise = createAuthConfig();
    cachedAuthConfig = await authConfigPromise;

    if (cachedAuthConfig.error) {
        Logger.error("Authentication configuration error: " + cachedAuthConfig.error);
        throw new Error("Invalid authentication configuration");
    }

    Logger.info("Authentication configuration cached successfully");
    return cachedAuthConfig;
}

/**
 * Get authentication configuration synchronously.
 * This function assumes the configuration has already been initialized.
 * Used for backward compatibility and ORD document generation.
 *
 * @returns {Object} Authentication configuration
 * @throws {Error} If configuration hasn't been initialized yet
 */
function getAuthConfigSync() {
    if (!cachedAuthConfig) {
        throw new Error(
            "Authentication configuration not initialized. Call getAuthConfig() first during service startup.",
        );
    }
    return cachedAuthConfig;
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

    // Validator should already be initialized at startup - direct use
    if (!authConfig.cfMtlsValidator) {
        Logger.error("CF mTLS validator not initialized");
        return { success: false, handled: true, error: "Authentication configuration error" };
    }

    try {
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
        Logger.error("CF mTLS authentication failed:", error.message);
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
 * Now uses module-level caching instead of cds.context for better reliability.
 */
async function authenticate(req, res, next) {
    let authConfig;

    try {
        // Get authentication configuration using module-level cache
        // Configuration should already be initialized during service startup
        authConfig = getAuthConfigSync();
    } catch {
        return res.status(500).send("Authentication configuration error");
    }

    // Handle invalid configuration
    if (!authConfig || !authConfig.accessStrategies || !Array.isArray(authConfig.accessStrategies)) {
        Logger.error("Invalid auth configuration:", authConfig);
        return res.status(401).send("Not authorized");
    }

    // Extract authentication types from access strategies and map them back to internal types for strategy lookup
    const authTypes = authConfig.accessStrategies.map((strategy) => strategy.type);

    // If open authentication, allow immediately
    if (authTypes.includes(ORD_ACCESS_STRATEGY.Open)) {
        res.status(200);
        return next();
    }

    // Try each registered authentication strategy
    const results = [];

    for (const ordAuthType of authTypes) {
        // Map ORD access strategy back to internal authentication type for strategy lookup
        let internalAuthType;
        if (ordAuthType === ORD_ACCESS_STRATEGY.Basic) {
            internalAuthType = AUTHENTICATION_TYPE.Basic;
        } else if (ordAuthType === ORD_ACCESS_STRATEGY.CfMtls) {
            internalAuthType = AUTHENTICATION_TYPE.CfMtls;
        } else if (ordAuthType === ORD_ACCESS_STRATEGY.Open) {
            internalAuthType = AUTHENTICATION_TYPE.Open;
        } else {
            Logger.warn(`Unknown ORD access strategy type: ${ordAuthType}`);
            continue;
        }

        const strategy = AUTH_STRATEGIES[internalAuthType];

        if (!strategy) {
            Logger.warn(`Unknown authentication type: ${internalAuthType}`);
            continue;
        }

        try {
            const result = await strategy(req, res, authConfig);
            results.push({ type: ordAuthType, ...result });

            if (result.success) {
                res.status(200);
                return next();
            }

            // If the strategy already sent a response (e.g., CF mTLS specific error codes)
            if (result.responseSent) {
                return;
            }
        } catch (error) {
            Logger.error(`Error in ${ordAuthType} authentication:`, error.message);
            results.push({ type: ordAuthType, success: false, handled: true, error: error.message });
        }
    }

    // If we reach here, authentication failed
    // Check if any strategy was attempted
    const attemptedStrategies = results.filter((r) => r.handled);

    if (attemptedStrategies.length === 0) {
        // No authentication method was attempted
        const wwwAuthHeaders = [];

        if (authTypes.includes(ORD_ACCESS_STRATEGY.Basic)) {
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
    getAuthConfigSync,
    detectAuthConfig,
};
