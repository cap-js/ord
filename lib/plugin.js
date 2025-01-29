const cds = require("@sap/cds");
const { ord, getMetadata, defaults, Logger } = require("./");
const { authenticate, getTrustedSubjects } = require("./authentication");

cds.on("bootstrap", async (app) => {
    if (!cds.context) {
        cds.context = {};
    }

    // TODO: Renewal of trustedSubjects every 7 days ??
    const trustedSubjects = await getTrustedSubjects();
    cds.context.trustedSubjects = trustedSubjects;

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
