const cds = require("@sap/cds");
const { AUTHENTICATION_TYPE } = require("./constants");

// Middleware for authentication
module.exports = (req, res, next) => {
    const authenticationType = process.env.ORD_AUTH || cds.env.authentication.type || AUTHENTICATION_TYPE.Open;
    switch (authenticationType) {
        case AUTHENTICATION_TYPE.Open:
            next();
            break;
        case AUTHENTICATION_TYPE.Basic: {
            const authHeader = req.headers['authorization'];
            if (!authHeader) {
                return res.status(401).send('Authorization header missing');
            }

            if (!authHeader.startsWith('Basic ')) {
                return res.status(401).send('Invalid authentication type');
            }

            const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
            if (username === cds.env.authentication.username && password === cds.env.authentication.password) {
                next();
            } else {
                return res.status(401).send('Invalid credentials');
            }
            break;
        }
        case AUTHENTICATION_TYPE.UclMtls:
            next();
            break;
            // const infoEndpoints = cds.env.infoEndpoints
            // return uclMtlsAuthentication(req, res, next);
        default:
            return res.status(500).send('Invalid authentication type');
    }
    // if (cds.env.authentication.type === AUTHENTICATION_TYPE.Open) {
    //     next();
    // }

    // // TODO: Implement client certificate authentication
    // if (cds.env.authentication.type === AUTHENTICATION_TYPE.UclMtls) {
    //     const infoEndpoints = cds.env.infoEndpoints ? JSON.parse(cds.env.infoEndpoints) : [];
    //     const hasUclMtlsValues = infoEndpoints.length > 0;

    //     if (!hasUclMtlsValues) {
    //         return res.status(500).send('No UCL/MTLS values provided');
    //     }
    //     next();
    // }

    // if (cds.env.authentication.type === AUTHENTICATION_TYPE.Basic) {
    //     const authHeader = req.headers['authorization'];
    //     if (!authHeader) {
    //         return res.status(401).send('Authorization header missing');
    //     }

    //     if (!authHeader.startsWith('Basic ')) {
    //         return res.status(401).send('Invalid authentication type');
    //     }

    //     const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    //     if (username === cds.env.authentication.username && password === cds.env.authentication.password) {
    //         next();
    //     } else {
    //         return res.status(401).send('Invalid credentials');
    //     }
    // }
}