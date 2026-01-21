const cds = require("@sap/cds");
const ord = require("./ord.js");
const getMetadata = require("./metaData.js");
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

        cds.app.get(`${this.path}`, (_, res) => {
            return res.status(200).send(defaults.baseTemplate(authConfig));
        });

        cds.app.get(`/ord/v1/documents/ord-document`, authMiddleware, async (_, res) => {
            // Debug logging for Issue #330 - EDMX resource links flaky behavior
            const contextModel = cds.context?.model;
            const globalModel = cds.model;
            const tenant = cds.context?.tenant;

            Logger.info(`[ORD Debug] Tenant: ${tenant || "undefined"}`);
            Logger.info(`[ORD Debug] cds.context exists: ${!!cds.context}`);
            Logger.info(`[ORD Debug] cds.context.model exists: ${!!contextModel}`);
            Logger.info(`[ORD Debug] cds.model exists: ${!!globalModel}`);
            Logger.info(`[ORD Debug] Using model from: ${contextModel ? "cds.context.model" : "cds.model"}`);

            const csn = contextModel || globalModel;

            if (csn) {
                const definitionsCount = Object.keys(csn.definitions || {}).length;
                const serviceCount = Object.values(csn.definitions || {}).filter((d) => d.kind === "service").length;
                Logger.info(`[ORD Debug] Model definitions count: ${definitionsCount}`);
                Logger.info(`[ORD Debug] Service count: ${serviceCount}`);
            } else {
                Logger.error(`[ORD Debug] No CSN model available!`);
            }

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
