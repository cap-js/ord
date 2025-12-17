const cds = require("@sap/cds");
const { ord, getMetadata, defaults, authentication, Logger } = require("./index.js");

class OpenResourceDiscoveryService extends cds.ApplicationService {
    async init() {
        // Initialize authentication configuration on service startup
        // This ensures the config is loaded from .cdsrc.json or environment variables
        // before any requests are processed
        // CF mTLS validator is lazily initialized on first use (or preloaded if CF_MTLS_PRELOAD=true)
        const authConfig = await authentication.getAuthConfig();
        
        // Create authentication middleware with the config
        const authMiddleware = authentication.createAuthMiddleware(authConfig);

        cds.app.get(`${this.path}`, (_, res) => {
            return res.status(200).send(defaults.baseTemplate);
        });

        cds.app.get(`/ord/v1/documents/ord-document`, authMiddleware, async (_, res) => {
            const csn = cds.context?.model || cds.model;
            const data = ord(csn);
            return res.status(200).send(data);
        });

        cds.app.get(`/ord/v1/documents/:id`, authMiddleware, async (_, res) => {
            return res.status(404).send("404 Not Found");
        });

        cds.app.get(`/ord/v1/:ordId?/:service?`, authMiddleware, async (req, res) => {
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
