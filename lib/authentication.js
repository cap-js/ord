const cds = require("@sap/cds");
const { AUTHENTICATION_TYPE, CERT_SUBJECT_HEADER_KEY } = require("./constants");
const { Logger } = require("./logger");

function getAuthenticationType() {
    return process.env.ORD_AUTH || cds.env.authentication?.type || AUTHENTICATION_TYPE.Open;
}

function getAuthData(type) {
    switch (type) {
        case AUTHENTICATION_TYPE.Basic: {
            const basicAuthData = JSON.parse(process.env.ORD_USERS || cds.env.authentication.credentials || "{}");
            return {
                type,
                ...Object.entries(basicAuthData).map(([username, password]) => ({ username, password }))[0]
            }
        }
        case AUTHENTICATION_TYPE.UclMtls: {
            const infoEndpoints = JSON.parse(process.env.UCL_MTLS_ENDPOINTS || cds.env.authentication.uclMtlsEndpoints || "[]");
            return {
                type,
                infoEndpoints
            };
        }
        default:
            return {};
    }
}

async function fetchTrustedSubject(endpoint) {
    try {
        // TODO: Implement fetching trusted subject from UCL endpoint
        Logger.log('TrustedSubjectService:', endpoint);
        return null;
        // const resp = await fetch(endpoint);
        // const jsonBody = (await resp.json());
        // return jsonBody.certSubject;
    } catch (error) {
        Logger.error('TrustedSubjectService:', error.message);
        return null;
    }
}

async function getTrustedSubjects() {
    const authData = getAuthData(AUTHENTICATION_TYPE.UclMtls);
    const subjects = await Promise.all(authData.infoEndpoints.map((endpoint) => fetchTrustedSubject(endpoint)));
    return subjects.filter((subject) => subject !== null);
}

// Middleware for authentication
async function authenticate(req, res, next) {
    const authType = getAuthenticationType();
    const authData = getAuthData(authType);

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
        case AUTHENTICATION_TYPE.UclMtls: {
            const certSubjectEncoded = req.headers[CERT_SUBJECT_HEADER_KEY] || "";
            const certSubject = Buffer.from(certSubjectEncoded, "base64").toString("ascii");
            const certSubjectTokens = certSubject.split(",").filter((token) => token);

            const matchesSomeTrustedSubject = cds.context.trustedSubjects
                .map((subj) => subj.split(",").map((token) => token.trim()))
                .some(
                    (trustedIssuerTokens) =>
                        trustedIssuerTokens.length === certSubjectTokens.length &&
                        trustedIssuerTokens.every((token) => certSubjectTokens.includes(token)),
                );

            if (!certSubject || !matchesSomeTrustedSubject) {
                return res.status(401).send('Certificate subject header is missing or invalid');
            }

            res.status(200);
            next();
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
    getAuthenticationType,
    getTrustedSubjects,
};