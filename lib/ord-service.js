const cds = require("@sap/cds");
const ord = require("./ord.js");
const compileMetadata = require("./metaData.js");
const defaults = require("./defaults.js");
const { createAuthConfig, createAuthMiddleware } = require("./auth/authentication.js");
const Logger = require("./logger.js");

class OpenResourceDiscoveryService extends cds.ApplicationService {
    async init() {
        // Initialize authentication configuration from .cdsrc.json or environment variables
        // CF mTLS validator is lazily initialized on first mTLS request
        const authConfig = createAuthConfig();
        if (authConfig.error) {
            throw new Error(`Authentication initialization failed: ${authConfig.error}`);
        }

        // Create authentication middleware
        const authMiddleware = createAuthMiddleware(authConfig);

        // ORD config endpoint does NOT need tenant context per ORD spec:
        // "ORD config does not contain tenant-specific information"
        cds.app.get(`${this.path}`, (_, res) => {
            return res.status(200).send(defaults.baseTemplate(authConfig));
        });

        // Handler for metadata requests (oas3, edmx, csn, etc.)
        const metadataHandler = async (req, res) => {
            try {
                const csn = cds.context?.model || cds.model;
                const { contentType, response } = await compileMetadata(req.url, csn);
                return res.status(200).contentType(contentType).send(response);
            } catch (error) {
                Logger.error(error, "Error while processing the resource definition document");
                return res.status(500).send(error.message);
            }
        };

        // Use an Express Router for all tenant-aware ORD routes and mount it
        // with cds.middlewares.before/after so that cds.context.tenant and
        // cds.context.model are populated (supports extensibility / toggles).
        const router = new (require("express").Router)();

        router.get(`/v1/documents/ord-document`, authMiddleware, async (_, res) => {
            const csn = cds.context?.model || cds.model;
            const data = ord(csn);
            return res.status(200).send(data);
        });

        router.get(`/v1/documents/:id`, authMiddleware, async (_, res) => {
            return res.status(404).send("404 Not Found");
        });

        // Use separate routes instead of optional parameters for path-to-regexp v8 compatibility
        router.get(`/v1/:ordId/:service`, authMiddleware, metadataHandler);
        router.get(`/v1/:ordId`, authMiddleware, metadataHandler);
        router.get(`/v1`, authMiddleware, metadataHandler);

        // Mount the router with CDS middlewares so tenant/model context is set
        cds.app.use("/ord", cds.middlewares.before, router, cds.middlewares.after);

        return super.init();
    }
}

module.exports = { OpenResourceDiscoveryService };
