const cds = require("@sap/cds");
const { ord, getMetadata, defaults, Logger } = require("./");
const { authenticate, getAuthenticationType, getTrustedSubjects } = require("./authentication");
const { AUTHENTICATION_TYPE } = require("./constants");

cds.on("bootstrap", async (app) => {
    try {
        const authType = getAuthenticationType();
        if (authType === AUTHENTICATION_TYPE.UclMtls) {
            // instantiate the context by using setter
            cds.context = {};
            cds.context.trustedSubjects = await getTrustedSubjects();// TODO: Renewal of trustedSubjects every N days
        }
    } catch (error) {
        Logger.error(error, 'Error while loading service');
    }

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
