const cds = require("@sap/cds");
const { Logger } = require("./logger");
const { ord, getMetadata, defaults } = require("./");


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

    app.get("/open-resource-discovery/v1/documents/1", async (req, res) => {
        try {
            const csn = cds.context?.model || cds.model;
            const data = ord(csn);
            return res.status(200).send(data);
        } catch (error) {
            Logger.error(error, 'Error while creating ORD document');
            return res.status(500).send(error.message);
        }
    });
});

module.exports = cds.server;
