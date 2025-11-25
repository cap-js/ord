const cds = require("@sap/cds");
const {
    AUTHENTICATION_TYPE,
    BASIC_AUTH_HEADER_KEY,
    AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP,
} = require("./constants");
const { Logger } = require("./logger");
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
 * Create authentication configuration based on environment variables or .cdsrc.json settings.
 * 
 * Configuration Priority (highest to lowest):
 * 1. Environment variables (ORD_AUTH_TYPE, BASIC_AUTH) - for production deployments
 * 2. .cdsrc.json settings (cds.env.authentication) - for development and testing
 * 
 * This approach follows the 12-Factor App principles where environment variables
 * can override configuration files for deployment flexibility.
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
            const cfMtlsConfig = createCfMtlsConfig(cds, Logger);
            
            if (cfMtlsConfig.error) {
                return Object.assign(defaultAuthConfig, { error: cfMtlsConfig.error });
            }
            
            authConfig.cfMtlsValidator = cfMtlsConfig.cfMtlsValidator;
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
        const result = handleCfMtlsAuthentication(req, res, authConfig, Logger);
        
        if (result.success) {
            res.status(200);
            return next();
        }
        
        // Response already sent by handleCfMtlsAuthentication
        return;
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
