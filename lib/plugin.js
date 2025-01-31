const cds = require("@sap/cds");
const { ord, getMetadata, defaults, Logger } = require("./");
const { authenticate } = require("./authentication");

cds.on("bootstrap", async (app) => {
    app.use("/.well-known/open-resource-discovery", async (req, res) => {
        res.status(200).send(defaults.baseTemplate);
    });

    app.get("/ord/v1/documents/*", authenticate, async (req, res) => {
        try {
            if (req.url.endsWith("/ord-document")) {
                const csn = await cds.load(cds.env.folders.srv);
                const data = ord(csn);
                return res.status(200).send(data);
            }
            if (req.url.includes("/api-metadata/")) {
                const { contentType, response } = await getMetadata(req.url);
                return res.status(200).contentType(contentType).send(response);
            }
            return res.status(404).send(`Cannot ${req.method} ${req.url}`);
        } catch (error) {
            Logger.error(error, 'Error while processing the request');
            return res.status(500).send(error.message);
        }
    });
});

module.exports = cds.server;
