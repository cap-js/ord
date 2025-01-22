const cds = require("@sap/cds");
const { Logger } = require("./logger");
const { AUTHENTICATION_TYPE } = require("./constants");
const { ord, getMetadata, defaults } = require("./");

// Middleware for authentication
const authenticate = (req, res, next) => {
    if (cds.env.authentication.type === AUTHENTICATION_TYPE.Open) {
        next();
    }

    // TODO: Implement client certificate authentication
    if (cds.env.authentication.type === AUTHENTICATION_TYPE.UclMtls) {
        const infoEndpoints = cds.env.infoEndpoints? JSON.parse(cds.env.infoEndpoints) : [];
        const hasUclMtlsValues = infoEndpoints.length > 0;

        if (!hasUclMtlsValues) {
            return res.status(500).send('No UCL/MTLS values provided');
        }
        next();
    }

    if (cds.env.authentication.type === AUTHENTICATION_TYPE.Basic) {
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
    }
};

cds.on("bootstrap", (app) => {
    app.use("/.well-known/open-resource-discovery", async (req, res) => {
        if (req.url === "/") {
            res.status(200).send(defaults.baseTemplate);
        } else {
            try {
                const { contentType, response } = await getMetadata(req.url);
                res.status(200).contentType(contentType).send(response);
            } catch (error) {
                Logger.error(error, 'Error while generating metadata');
                res.status(500).send(error.message);
            }
        }
    });

    app.get("/open-resource-discovery/v1/documents/1", authenticate, async (req, res) => {
        try {
            const csn = await cds.load(cds.env.folders.srv);
            const data = ord(csn);
            return res.status(200).send(data);
        } catch (error) {
            Logger.error(error, 'Error while creating ORD document');
            return res.status(500).send(error.message);
        }
    });
});

module.exports = cds.server;
