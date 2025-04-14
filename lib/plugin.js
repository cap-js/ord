const cds = require("@sap/cds");
const { Logger } = require("./logger");
const { authenticate, getAuthConfig } = require("./authentication");
const { ord, getMetadata, defaults } = require("./");

cds.on("bootstrap", async (app) => {

    getAuthConfig();

    app.use("/.well-known/open-resource-discovery", async (req, res) => {
        res.status(200).send(defaults.baseTemplate);
    });

    // ORD documents route: /ord/v1/documents/:documentName
    app.get("/ord/v1/documents/:documentName", authenticate, async (_, res) => {
        try {
            const csn = cds.context?.model || cds.model;
            const data = ord(csn);
            return res.status(200).send(data);
        } catch (error) {
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

    if (process.env.ORD_INDEX_PAGE === 'true') {
        const OrdService = await cds.load('./ord/ord-service.cds'); // Adjust path as needed
        cds.serve('OrdService').from(OrdService).in(app);
    }
});

module.exports = cds.server;