const cds = require("@sap/cds");
const { ord, getMetadata, defaults } = require("./");
const { Logger } = require("./logger");
const { authenticate, createAuthConfig } = require("./authentication");

cds.on("bootstrap", async (app) => {
    const authConfiguration = createAuthConfig();

    if (authConfiguration.error) {
        Logger.error('Authentication configuration error: ' + authConfiguration.error);
        throw new Error('Invalid authentication configuration');
    }

    // initialize the context object
    if (!cds.context) {
        cds.context = {};
    }

    // validate and create authentication configuration based on data given in the environment variables; at the end, store it in cds.context.
    cds.context.authConfig = authConfiguration;

    app.use("/.well-known/open-resource-discovery", async (req, res) => {
        res.status(200).send(defaults.baseTemplate);
    });

    // ORD documents route: /ord/v1/documents/:documentName
    app.get("/ord/v1/documents/:documentName", authenticate, async (_, res) => {
        try {
            const csn = await cds.load(cds.env.folders.srv);
            const data = ord(csn);
            return res.status(200).send(data);
        }
        catch (error) {
            Logger.error(error, 'Error while creating ORD document');
            return res.status(500).send(error.message);
        }
    });

    // Resource Definition documents route: /ord/v1/:ordId/:fileName
    app.get("/ord/v1/:ordId/:fileName", authenticate, async (req, res) => {
        try {
            const { contentType, response } = await getMetadata(req.url);
            return res.status(200).contentType(contentType).send(response);

        } catch (error) {
            Logger.error(error, 'Error while processing the resource definition document');
            return res.status(500).send(error.message);
        }
    });
});

module.exports = cds.server;
