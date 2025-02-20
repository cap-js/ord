const cds = require("@sap/cds");
const { AUTHENTICATION_TYPE, BASIC_AUTH_HEADER_KEY, AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP } = require("./constants");
const { Logger } = require("./logger");

/**
 * Create authentication configuration based on data given in the environment variables.
 * @returns {Object} Authentication configuration object or default configuration object as a fallback.
 */
function createAuthConfig() {
    const defaultAuthConfig = {
        types: [AUTHENTICATION_TYPE.Open],
        accessStrategies: [{ type: AUTHENTICATION_TYPE.Open }]
    };

    try {
        const authConfig = {};

        authConfig.types = process.env.ORD_AUTH_TYPE ?
            [...new Set(JSON.parse(process.env.ORD_AUTH_TYPE))] :
            [...new Set(cds.env.authentication?.types)];

        if (!authConfig.types || authConfig.types.length === 0) {
            Logger.error('createAuthConfig:', 'No authorization type is provided. Defaulting to "Open" authentication');
            return defaultAuthConfig;
        }

        if (authConfig.types.some(authType => !Object.values(AUTHENTICATION_TYPE).includes(authType))) {
            return Object.assign(defaultAuthConfig, { error: 'Invalid authentication type' });
        }

        if (authConfig.types.includes(AUTHENTICATION_TYPE.Open) && authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
            return Object.assign(defaultAuthConfig, { error: 'Open authentication cannot be combined with any other authentication type' });
        }

        if (authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
            const credentials = process.env.BASIC_AUTH ? JSON.parse(process.env.BASIC_AUTH) : cds.env.authentication.credentials;
            authConfig.credentials = Object.entries(credentials).map(([username, password]) => ({
                username, password
            }))[0];
        }

        authConfig.accessStrategies = authConfig.types.map(type => ({
            type: AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP[type]
        }))
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
        Logger.error('Authentication configuration error: ' + authConfig.error);
        throw new Error('Invalid authentication configuration');
    }

    // set the context
    cds.context = {
        authConfig
    }
    return cds.context?.authConfig
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

    if (!Object.keys(req.headers).includes(BASIC_AUTH_HEADER_KEY) && authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
        return res.status(401).setHeader('WWW-Authenticate', 'Basic realm="401"').send('Authentication required.');
    }

    if (req.headers[BASIC_AUTH_HEADER_KEY] && authConfig.types.includes(AUTHENTICATION_TYPE.Basic)) {
        const authHeader = req.headers[BASIC_AUTH_HEADER_KEY];

        if (!authHeader.startsWith('Basic ')) {
            return res.status(401).send('Invalid authentication type');
        }

        const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const credentials = authConfig.credentials;
        if (username === credentials?.username && password === credentials?.password) {
            res.status(200);
            return next();
        } else {
            return res.status(401).send('Invalid credentials');
        }
    }

    // In other cases, the request is unauthorized.
    // TODO: Add support for UCL-mTLS authorization.
    return res.status(401).send('Not authorized');
}

module.exports = {
    authenticate,
    createAuthConfig,
    getAuthConfig
};