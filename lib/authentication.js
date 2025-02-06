const cds = require("@sap/cds");
const { AUTHENTICATION_TYPE, BASIC_AUTH_HEADER_KEY, CERT_SUBJECT_HEADER_KEY } = require("./constants");
const { Logger } = require("./logger");

function _getAuthConfiguration(type) {
    try {
        if (type === AUTHENTICATION_TYPE.Basic) {
            const basicAuthData = process.env.APP_USERS ?
                JSON.parse(process.env.APP_USERS) :
                cds.env.authentication.credentials;
            return {
                type,
                ...Object.entries(basicAuthData).map(([username, password]) => ({ username, password }))[0]
            };
        } else {
            return {};
        }
    } catch (error) {
        Logger.error('_getAuthConfiguration:', error.message);
        return {};
    }
}

function getAuthenticationTypes() {
    try {
        // Keep only unique values by converting the array to a Set and then back to an array
        const authTypes = process.env.ORD_AUTH ?
            [...new Set(JSON.parse(process.env.ORD_AUTH))] :
            [...new Set(cds.env.authentication?.type)];

        if (authTypes.length === 0) {
            Logger.error('getAuthenticationTypes:', "No authorization type is provided. Defaulting to 'Open' authentication");
            return [AUTHENTICATION_TYPE.Open];
        }

        if (authTypes.some(authType => !Object.values(AUTHENTICATION_TYPE).includes(authType))) {
            Logger.error('getAuthenticationTypes:', 'Invalid authentication type');
            return [AUTHENTICATION_TYPE.Open];
        }
        if (authTypes.length > 1 && authTypes.includes(AUTHENTICATION_TYPE.Open) && authTypes.includes(AUTHENTICATION_TYPE.Basic)) {
            Logger.error('getAuthenticationTypes:', 'Open authentication cannot be combined with any other authentication type');
            return [AUTHENTICATION_TYPE.Open];
        }
        return authTypes;
    } catch (error) {
        Logger.error('getAuthenticationTypes:', error.message);
        return [AUTHENTICATION_TYPE.Open];
    }
}

// Middleware for authentication
async function authenticate(req, res, next) {
    const authTypes = getAuthenticationTypes();

    if (authTypes.includes(AUTHENTICATION_TYPE.Open)) {
        res.status(200);
        next();
        return;
    }

    if (!Object.keys(req.headers).includes(BASIC_AUTH_HEADER_KEY, CERT_SUBJECT_HEADER_KEY)) {
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
        const authConfigData = _getAuthConfiguration(AUTHENTICATION_TYPE.Basic);

        if (username === authConfigData.username && password === authConfigData.password) {
            res.status(200);
            next();
            return;
        } else {
            return res.status(401).send('Invalid credentials');
        }
    }

    // TODO: Add support for mTLS.
    return res.status(401).send('Not authorized');
}

module.exports = {
    authenticate,
    getAuthenticationTypes
};