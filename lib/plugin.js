const cds = require("@sap/cds");
const { Logger } = require("./logger");
const { ord, getMetadata, defaults, AUTHENTICATION_METHODS } = require("./");

// Middleware for authentication
const authenticate = (req, res, next) => {
    const authMethod = req.headers['x-auth-method'];

    switch (authMethod) {
        case AUTHENTICATION_METHODS.open:
            // No authentication required
            next();
            break;
        case AUTHENTICATION_METHODS.basic: {
            const authHeader = req.headers['authorization'];
            if (!authHeader) {
                return res.status(401).send('Authorization header missing');
            }
            const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
            if (username === 'your-username' && password === 'your-password') {
                next();
            } else {
                return res.status(401).send('Invalid credentials');
            }
            break;
        }
        case AUTHENTICATION_METHODS.uclMtls:
            // Check client certificate
            if (req.client.authorized) {
                next();
            } else {
                return res.status(401).send('Client certificate required');
            }
            break;
        default:
            return res.status(400).send('Unsupported authentication method');
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
