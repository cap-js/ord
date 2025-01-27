const cds = require("@sap/cds");
const { AUTHENTICATION_TYPE } = require("./constants");

/**
 * Depending on authentication type, return the credentials in case of the basic authentication
 * or mtls endpoints in case of UCL-mtls
 */
function getAuthenticationDetails() {
    function getBasicAuthDetails() {
        const basicAuthData = process.env.APP_USERS ?
            JSON.parse(process.env.APP_USERS) :
            cds.env.authentication.credentials ?
                JSON.parse(cds.env.authentication.credentials) : {};

        return Object.entries(basicAuthData).map(([username, password]) => ({ username, password }))[0];
    }

    switch (process.env.ORD_AUTH || cds.env.authentication?.type || AUTHENTICATION_TYPE.Open) {
        case AUTHENTICATION_TYPE.Basic:
            return {
                type: AUTHENTICATION_TYPE.Basic,
                ...getBasicAuthDetails()
            };
        case AUTHENTICATION_TYPE.UclMtls:
            return {
                type: AUTHENTICATION_TYPE.UclMtls,
                infoEndpoints: process.env.UCL_MTLS_ENDPOINTS ?? cds.env.authentication.uclMtlsEndpoints
            };
        default:
            return {
                type: AUTHENTICATION_TYPE.Open
            };
    }
}

// Middleware for authentication
module.exports = (req, res, next) => {
    const authData = getAuthenticationDetails();
    switch (authData.type) {
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
            if (username === authData.username && password === authData.password) {
                res.status(200);
                next();
            } else {
                return res.status(401).send('Invalid credentials');
            }
            break;
        }
        case AUTHENTICATION_TYPE.UclMtls:
            res.status(200);
            next();
            break;
        // const infoEndpoints = cds.env.infoEndpoints
        // return uclMtlsAuthentication(req, res, next);
        default: // Open access
            res.status(200);
            next();
            break;
    }
}