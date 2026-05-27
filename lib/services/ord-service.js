const cds = require("@sap/cds");

const { slice } = require("../common/slice");
const ord = require("../ord.js");
const Logger = require("../logger.js");
const defaults = require("../defaults.js");
const compileMetadata = require("../meta-data.js");
const { createAuthConfig, createAuthMiddleware } = require("../auth/authentication.js");
const { LOCAL_TENANT_ID_HEADER_KEY, DOCUMENT_PERSPECTIVES } = require("../constants");

const validationMiddleware = (req, res, next) => {
    const toggles = cds.env.requires.toggles;
    const perspective = req.query.perspective;
    const extensibility = cds.env.requires.extensibility;
    const tenant = req.headers[LOCAL_TENANT_ID_HEADER_KEY];

    if (
        perspective &&
        ![DOCUMENT_PERSPECTIVES.SystemVersion, DOCUMENT_PERSPECTIVES.SystemInstance].includes(perspective)
    ) {
        return res.status(400).send(`Required query parameter 'perspective' is invalid`);
    }

    if (perspective === DOCUMENT_PERSPECTIVES.SystemInstance && !(toggles || extensibility)) {
        return res.status(400).send(`Unsupported query parameter 'perspective=${perspective}'`);
    }

    if (!tenant && perspective === DOCUMENT_PERSPECTIVES.SystemInstance) {
        return res.status(400).send(`Missing required tenant context`);
    }

    return next();
};

const metadataResponseHandler = async (req, res) => {
    try {
        const perspective = req.query.perspective;
        const tenant = req.headers[LOCAL_TENANT_ID_HEADER_KEY];
        const model = await resolveCdsModel(perspective, tenant);
        const { contentType, response } = await compileMetadata(req.path, model);

        return res.status(200).contentType(contentType).send(response);
    } catch (error) {
        Logger.error(error, "Error while processing the resource definition document");
        return res.status(500).send(error.message);
    }
};

const resolveCdsModel = async (perspective, tenant) => {
    if (!tenant || perspective !== DOCUMENT_PERSPECTIVES.SystemInstance) {
        Logger.info("Retrieving static CDS model...");
        return cds.model;
    }

    Logger.info(`Retrieving dynamic CDS model for tenant ${tenant}...`);

    return await (
        await cds.connect.to("cds.xt.ModelProviderService")
    ).getCsn({
        tenant: tenant,
        toggles: OpenResourceDiscoveryService.resolveFeatureToggles(tenant),
    });
};

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

        // Default: /.well-known/open-resource-discovery
        cds.app.get(`${this.path}`, (req, res) => {
            const toggles = cds.env.requires.toggles;
            const extensibility = cds.env.requires.extensibility;
            const tenant = req.headers[LOCAL_TENANT_ID_HEADER_KEY];
            const extensions = Array.from(Object.values(this.extensions));

            return res
                .status(200)
                .send(
                    defaults.baseTemplate(
                        authConfig,
                        ord(cds.model, extensions),
                        !tenant || (!toggles && !extensibility)
                            ? undefined
                            : ord(resolveCdsModel(DOCUMENT_PERSPECTIVES.SystemInstance, tenant), extensions),
                    ),
                );
        });

        cds.app.get(`/ord/v1/documents/ord-document`, [authMiddleware, validationMiddleware], async (req, res) => {
            const part = req.query.part || 0;
            const tenant = req.headers[LOCAL_TENANT_ID_HEADER_KEY];
            const perspective = req.query.perspective || DOCUMENT_PERSPECTIVES.SystemVersion;
            const model = await resolveCdsModel(perspective, tenant);
            const extensions = Array.from(Object.values(this.extensions));

            return res
                .status(200)
                .send(
                    slice(defaults.adjustForPerspective(ord(model, extensions), perspective), defaults.sizeLimit)[part],
                );
        });

        cds.app.get(`/ord/v1/documents/:id`, [authMiddleware, validationMiddleware], async (_, res) => {
            return res.status(404).send("404 Not Found");
        });

        // Use separate routes instead of optional parameters for path-to-regexp v8 compatibility
        cds.app.get(`/ord/v1/:ordId/:service`, [authMiddleware, validationMiddleware], metadataResponseHandler);
        cds.app.get(`/ord/v1/:ordId`, [authMiddleware, validationMiddleware], metadataResponseHandler);
        cds.app.get(`/ord/v1`, [authMiddleware, validationMiddleware], metadataResponseHandler);

        return super.init();
    }

    // eslint-disable-next-line no-unused-vars
    static resolveFeatureToggles(tenant) {
        return ["*"];
    }
}

module.exports = { OpenResourceDiscoveryService };
