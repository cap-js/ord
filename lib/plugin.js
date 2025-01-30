const cds = require("@sap/cds");
const { ord, getMetadata, defaults, Logger } = require("./");
const { authenticate, getTrustedSubjects } = require("./authentication");

cds.on("bootstrap", async (app) => {
    try {
        // TODO: Renewal of trustedSubjects every N days ??
        if (!cds.context) {
            cds.context = cds.context || {};
        }
        if (!cds.context.trustedSubjects) {
            cds.context.trustedSubjects = await getTrustedSubjects();// TODO: Store trusted subjects in context or somewhere else??
        }
    } catch (error) {
        Logger.error(error, 'Error while loading service');
    }



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
    // /ord/v1/documents - for all ORD documents
    // /ord/v1/${ordId}/json(so the extension can be .json or .edmx-the content is xml in this case)

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
