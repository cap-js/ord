const cds = require("@sap/cds");
const { Logger } = require("./logger");
const { authenticate, getAuthConfig } = require("./authentication");
const { ord, getMetadata, defaults } = require("./");

cds.on("bootstrap", async (app) => {

    getAuthConfig();

    app.use("/.well-known/open-resource-discovery", async (req, res) => {
        res.status(200).send(defaults.baseTemplate);
    });

    // note: this route does not care about documentName
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

    // example : http://localhost:4004/ord/v1/sap.sample:apiResource:sap.capire.incidents.LocalService:v1/sap.capire.incidents.LocalService.oas3.json
    // note: this route does not care about ordId
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