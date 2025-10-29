const cds = require("@sap/cds");
const { AUTHENTICATION_TYPE, BASIC_AUTH_HEADER_KEY, AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP } = require("./constants");
const { Logger } = require("./logger");
const bcrypt = require("bcryptjs");
const { validateMtlsConfig } = require("./middleware/mtlsAuthentication");

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
            (authConfig.types.includes(AUTHENTICATION_TYPE.Basic) || authConfig.types.includes(AUTHENTICATION_TYPE.MTLS))
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

        if (authConfig.types.includes(AUTHENTICATION_TYPE.MTLS)) {
            // Get mTLS config from cds.env.authentication.mtls
            const mtlsConfig = cds.env.authentication?.mtls || {};
            
            // Validate mTLS configuration
            const mtlsValidation = validateMtlsConfig(mtlsConfig);
            if (!mtlsValidation.isValid) {
                Logger.error("createAuthConfig:", `mTLS configuration errors: ${mtlsValidation.errors.join(", ")}`);
                return Object.assign(defaultAuthConfig, { error: "Invalid mTLS configuration" });
            }
            
            // Store mTLS configuration
            authConfig.mtls = mtlsConfig;
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

    // Try mTLS authentication first if configured
    if (authConfig.types.includes(AUTHENTICATION_TYPE.MTLS)) {
        try {
            const { createMtlsAuthMiddleware } = require("./middleware/mtlsAuthentication");
            const mtlsMiddleware = await createMtlsAuthMiddleware(authConfig.mtls);
            
            // Create a promise-based wrapper for the middleware
            const mtlsResult = await new Promise((resolve, reject) => {
                mtlsMiddleware(req, res, (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(true);
                    }
                });
            });

            if (mtlsResult && req.isMtlsAuthenticated) {
                res.status(200);
                return next();
            }
        } catch (error) {
            Logger.log(`mTLS authentication failed: ${error.message}`);
            // Continue to basic auth if both are configured
            if (!authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
                return res.status(401).send("mTLS authentication failed");
            }
        }
    }

    // Handle Basic Authentication
    if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
        if (!Object.keys(req.headers).includes(BASIC_AUTH_HEADER_KEY)) {
            return res.status(401).setHeader("WWW-Authenticate", 'Basic realm="401"').send("Authentication required.");
        }

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

    // If we get here, no authentication method succeeded
    return res.status(401).send("Not authorized");
}

module.exports = {
    authenticate,
    createAuthConfig,
    getAuthConfig,
};
