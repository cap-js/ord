const cds = require("@sap/cds");
const { AUTHENTICATION_TYPE } = require("./constants");
const { Logger } = require("./logger");

function getAuthenticationType() {
    return process.env.ORD_AUTH || cds.env.authentication?.type || AUTHENTICATION_TYPE.Open;
}

function getAuthConfiguration(type) {
    try {
        switch (type) {
            case AUTHENTICATION_TYPE.Basic: {
                const basicAuthData = process.env.APP_USERS ?? cds.env.authentication.credentials;
                return {
                    type,
                    ...Object.entries(JSON.parse(basicAuthData)).map(([username, password]) => ({ username, password }))[0]
                }
            }
            default:
                return {};
        }
    } catch (error) {
        Logger.error('getAuthConfiguration:', error.message);
        return {};
    }


}

// Middleware for authentication
async function authenticate(req, res, next) {
    const authType = getAuthenticationType();
    const authConfigData = getAuthConfiguration(authType);

    switch (authConfigData.type) {
        case AUTHENTICATION_TYPE.Basic: {
            const authHeader = req.headers['authorization'];

            if (!authHeader) {
                res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
                return res.status(401).send('Authorization header missing');
            }

            if (!authHeader.startsWith('Basic ')) {
                return res.status(401).send('Invalid authentication type');
            }

            const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
            if (username === authConfigData.username && password === authConfigData.password) {
                res.status(200);
                next();
            } else {
                return res.status(401).send('Invalid credentials');
            }
            break;
        }
        default: // Open access
            res.status(200);
            next();
            break;
    }
}

module.exports = {
    authenticate,
    getAuthenticationType
};