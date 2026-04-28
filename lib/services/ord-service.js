const cds = require("@sap/cds");

const ord = require("../ord.js");
const Logger = require("../logger.js");
const defaults = require("../defaults.js");
const { LOCAL_TENANT_ID_HEADER_KEY } = require("../constants");
const compileMetadata = require("../meta-data.js");
const { createAuthConfig, createAuthMiddleware } = require("../auth/authentication.js");

class OpenResourceDiscoveryService extends cds.ApplicationService {
    async init() {
        this.extensions = {};

        cds.on("ord.extension.publish", ({ id, data }) => {
            Logger.info(`Registering extension with id ${id}...`);

            this.extensions[id] = data;
        });

        // Initialize authentication configuration from .cdsrc.json or environment variables
        // CF mTLS validator is lazily initialized on first mTLS request
        const authConfig = createAuthConfig();
        if (authConfig.error) {
            throw new Error(`Authentication initialization failed: ${authConfig.error}`);
        }

        // Create authentication middleware
        const authMiddleware = createAuthMiddleware(authConfig);

        const getCdsModel = async (tenant) => {
            if (!tenant || !(cds.env.requires.toggles || cds.env.requires.extensibility)) {
                return cds.model;
            }

            return await (
                await cds.connect.to("cds.xt.ModelProviderService")
            ).getCsn({
                tenant: tenant,
                toggles: OpenResourceDiscoveryService.resolveFeatureToggles(tenant),
            });
        };

        cds.app.get(`${this.path}`, (_, res) => {
            return res.status(200).send(defaults.baseTemplate(authConfig));
        });

        cds.app.get(`/ord/v1/documents/ord-document`, authMiddleware, async (req, res) => {
            const extensions = Array.from(Object.values(this.extensions));
            const model = await getCdsModel(req.headers[LOCAL_TENANT_ID_HEADER_KEY]);

            return res.status(200).send(ord(model, extensions));
        });

        cds.app.get(`/ord/v1/documents/:id`, authMiddleware, async (_, res) => {
            return res.status(404).send("404 Not Found");
        });

        // Handler for metadata requests (oas3, edmx, csn, etc.)
        const metadataHandler = async (req, res) => {
            try {
                const model = await getCdsModel(req.headers[LOCAL_TENANT_ID_HEADER_KEY]);
                const { contentType, response } = await compileMetadata(req.url, model);

                return res.status(200).contentType(contentType).send(response);
            } catch (error) {
                Logger.error(error, "Error while processing the resource definition document");
                return res.status(500).send(error.message);
            }
        };

        // Use separate routes instead of optional parameters for path-to-regexp v8 compatibility
        cds.app.get(`/ord/v1/:ordId/:service`, authMiddleware, metadataHandler);
        cds.app.get(`/ord/v1/:ordId`, authMiddleware, metadataHandler);
        cds.app.get(`/ord/v1`, authMiddleware, metadataHandler);

        return super.init();
    }

    // eslint-disable-next-line no-unused-vars
    static resolveFeatureToggles(tenant) {
        return ["*"];
    }
}

module.exports = { OpenResourceDiscoveryService };
