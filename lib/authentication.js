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

        // Debug logging for configuration loading
        Logger.log("createAuthConfig: process.env.ORD_AUTH_TYPE =", process.env.ORD_AUTH_TYPE);
        Logger.log("createAuthConfig: cds.env.authentication =", JSON.stringify(cds.env.authentication, null, 2));

        // Load authentication types from environment variable or CDS configuration
        if (process.env.ORD_AUTH_TYPE) {
            authConfig.types = [...new Set(JSON.parse(process.env.ORD_AUTH_TYPE))];
        } else if (cds.env.authentication?.types) {
            authConfig.types = [...new Set(cds.env.authentication.types)];
        } else {
            // Fallback: try to load directly from CDS config if cds.env.authentication is not populated
            try {
                const cdsConfig = require(require('path').resolve('.cdsrc.json'));
                if (cdsConfig.authentication?.types) {
                    authConfig.types = [...new Set(cdsConfig.authentication.types)];
                    Logger.log("createAuthConfig: Loaded authentication types directly from .cdsrc.json");
                }
            } catch (error) {
                Logger.log("createAuthConfig: Could not load .cdsrc.json directly:", error.message);
            }
        }

        Logger.log("createAuthConfig: Resolved auth types =", authConfig.types);

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
            let credentials;
            if (process.env.BASIC_AUTH) {
                credentials = JSON.parse(process.env.BASIC_AUTH);
            } else if (cds.env.authentication?.credentials) {
                credentials = cds.env.authentication.credentials;
            } else {
                // Fallback: try to load directly from CDS config
                try {
                    const cdsConfig = require(require('path').resolve('.cdsrc.json'));
                    credentials = cdsConfig.authentication?.credentials;
                    Logger.log("createAuthConfig: Loaded basic auth credentials directly from .cdsrc.json");
                } catch (error) {
                    Logger.log("createAuthConfig: Could not load credentials from .cdsrc.json:", error.message);
                }
            }

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
            // Get mTLS config from cds.env.authentication.mtls or directly from .cdsrc.json
            let mtlsConfig;
            if (cds.env.authentication?.mtls) {
                mtlsConfig = cds.env.authentication.mtls;
            } else {
                // Fallback: try to load directly from CDS config
                try {
                    const cdsConfig = require(require('path').resolve('.cdsrc.json'));
                    mtlsConfig = cdsConfig.authentication?.mtls || {};
                    Logger.log("createAuthConfig: Loaded mTLS config directly from .cdsrc.json");
                } catch (error) {
                    Logger.log("createAuthConfig: Could not load mTLS config from .cdsrc.json:", error.message);
                    mtlsConfig = {};
                }
            }
            
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
    const authConfig = getAuthConfig();

    if (authConfig.types.includes(AUTHENTICATION_TYPE.Open)) {
        res.status(200);
        return next();
    }

    // Try mTLS authentication first if configured
    if (authConfig.types.includes(AUTHENTICATION_TYPE.MTLS)) {
        try {
            // Check if this request has mTLS headers before attempting mTLS auth
            const hasMtlsHeaders = req.headers["x-ssl-client-verify"] !== undefined;
            
            if (hasMtlsHeaders) {
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
                    // Set CDS user context so CDS auth middleware recognizes the authenticated request
                    const mtlsUser = new cds.User({
                        id: req.clientCertificate?.subject?.CN || 'mtls-user',
                        roles: ['mtls-authenticated'],
                        _is_privileged: true // Mark as privileged to bypass CDS authorization checks
                    });
                    
                    // Set both Express and CDS contexts
                    req.user = mtlsUser;
                    cds.context.user = mtlsUser;
                    
                    Logger.log(`mTLS: Set CDS user context for ${mtlsUser.id}`);
                    res.status(200);
                    return next();
                }
            } else {
                Logger.log("mTLS: No mTLS headers detected, skipping mTLS authentication");
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
            // Set CDS user context so CDS auth middleware recognizes the authenticated request
            const basicUser = new cds.User({
                id: username,
                roles: ['basic-authenticated'],
                _is_privileged: true // Mark as privileged to bypass CDS authorization checks
            });
            
            // Set both Express and CDS contexts
            req.user = basicUser;
            cds.context.user = basicUser;
            
            Logger.log(`Basic Auth: Set CDS user context for ${basicUser.id}`);
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
