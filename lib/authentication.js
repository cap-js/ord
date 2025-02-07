const cds = require("@sap/cds");
const { AUTHENTICATION_TYPE, BASIC_AUTH_HEADER_KEY, CERT_SUBJECT_HEADER_KEY } = require("./constants");
const { Logger } = require("./logger");

/**
 * Create authentication configuration based on data given in the environment variables.
 * @returns {Object} Authentication configuration object or default configuration object as a fallback.
 */
function createAuthConfig() {
    const defaultAuthConfig = {
        types: [AUTHENTICATION_TYPE.Open]
    };

    try {
        const authConfig = {};

        authConfig.types = process.env.ORD_AUTH ?
            [...new Set(JSON.parse(process.env.ORD_AUTH))] :
            [...new Set(cds.env.authentication?.type)];

        if (authConfig.types.length === 0) {
            Logger.error('createAuthConfig:', 'No authorization type is provided. Defaulting to "Open" authentication');
            return defaultAuthConfig;
        }

        if (authConfig.types.some(authType => !Object.values(AUTHENTICATION_TYPE).includes(authType))) {
            Logger.error('createAuthConfig:', 'Invalid authentication type');
            return defaultAuthConfig;
        }

        if (authConfig.types.length > 1 &&
            authConfig.types.includes(AUTHENTICATION_TYPE.Open) &&
            authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
            Logger.error('createAuthConfig:', 'Open authentication cannot be combined with any other authentication type');
            return defaultAuthConfig;
        }

        if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
            if (process.env.APP_USER) {
                authConfig.credentials = Object.entries(JSON.parse(process.env.APP_USER)).map(([username, password]) =>
                ({
                    username, password
                }))[0];
            } else {
                authConfig.credentials = Object.entries(cds.env.authentication.credentials).map(([username, password]) =>
                ({
                    username, password
                }))[0];
            }
        }

        return authConfig;
    } catch (error) {
        Logger.error('createAuthConfig:', error.message);
        return defaultAuthConfig;
    }
}

/**
 * Retrieve distinct values for the authentication types from environment variables.
 * @returns {Array<string>} Array of authentication types
 */
function getAuthenticationTypes() {
    if (process.env.ORD_AUTH) {
        return [...new Set(JSON.parse(process.env.ORD_AUTH))];
    } else {
        return [...new Set(cds.env.authentication?.type)];
    }
}

/**
 * Middleware to authenticate the request based on the authentication configuration.
 */
async function authenticate(req, res, next) {
    const authTypes = cds.context.authConfig.types;

    if (authTypes.includes(AUTHENTICATION_TYPE.Open)) {
        res.status(200);
        next();
        return;
    }

    if (!Object.keys(req.headers).includes(BASIC_AUTH_HEADER_KEY) &&
        !Object.keys(req.headers).includes(CERT_SUBJECT_HEADER_KEY)) {
        if (authTypes.includes(AUTHENTICATION_TYPE.Basic)) {
            res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
        }

        return res.status(401).send('Required header is missing');
    }

    if (req.headers[BASIC_AUTH_HEADER_KEY] && authTypes.includes(AUTHENTICATION_TYPE.Basic)) {
        const authHeader = req.headers[BASIC_AUTH_HEADER_KEY];

        if (!authHeader.startsWith('Basic ')) {
            return res.status(401).send('Invalid authentication type');
        }

        const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const credentials = cds.context.authConfig.credentials;
        if (username === credentials.username && password === credentials.password) {
            res.status(200);
            next();
            return;
        } else {
            return res.status(401).send('Invalid credentials');
        }
    }

    // TODO: Add support for UCL-mTLS authorization.
    return res.status(401).send('Not authorized');
}

module.exports = {
    authenticate,
    getAuthenticationTypes,
    createAuthConfig
};