const cds = require("@sap/cds");
const { ord, getMetadata, defaults, authentication, Logger } = require("./index.js");

class OpenResourceDiscoveryService extends cds.ApplicationService {
    async init() {
        // Initialize authentication configuration on service startup
        // This ensures the config is loaded from .cdsrc.json or environment variables
        // before any requests are processed
        // Now using async initialization with CF mTLS validator creation
        try {
            await authentication.getAuthConfig();
            Logger.info("Authentication configuration initialized successfully");
        } catch (error) {
            Logger.error("Failed to initialize authentication configuration:", error.message);
            throw error; // Fail service startup if auth config is invalid
        }

        cds.app.get(`${this.path}`, (req, res) => {
            return res.status(200).send(defaults.baseTemplate);
        });

        cds.app.get(`/ord/v1/documents/ord-document`, authentication.authenticate, async (req, res) => {
            const csn = cds.context?.model || cds.model;
            const data = ord(csn);
            return res.status(200).send(data);
        });

        cds.app.get(`/ord/v1/documents/:id`, authentication.authenticate, async (req, res) => {
            return res.status(404).send("404 Not Found");
        });

        cds.app.get(`/ord/v1/:ordId?/:service?`, authentication.authenticate, async (req, res) => {
            try {
                const { contentType, response } = await getMetadata(req.url);
                return res.status(200).contentType(contentType).send(response);
            } catch (error) {
                Logger.error(error, "Error while processing the resource definition document");
                return res.status(500).send(error.message);
            }
        });

        return super.init();
    }
}

module.exports = { OpenResourceDiscoveryService };
