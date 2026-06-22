const cds = require("@sap/cds");

const { slice } = require("../common/slice");
const ord = require("../ord.js");
const Logger = require("../logger.js");
const defaults = require("../defaults.js");
const compileMetadata = require("../meta-data.js");
const { createAuthConfig, createAuthMiddleware } = require("../auth/authentication.js");
const { LOCAL_TENANT_ID_HEADER_KEY, DOCUMENT_PERSPECTIVES } = require("../constants");
const { withSpan, recordRequest } = require("../telemetry");

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

// Resource-definition documents (CSN / OAS3 / AsyncAPI / MCP). The HTTP root
// span is created by @opentelemetry/instrumentation-http; the `withSpan` below
// adds an INTERNAL child span around the compile step, which is where the real
// CPU work happens.
const metadataResponseHandler = async (req, res) => {
    try {
        const perspective = req.query.perspective;
        const tenant = req.headers[LOCAL_TENANT_ID_HEADER_KEY];
        const model = await resolveCdsModel(perspective, tenant);
        const { contentType, response } = await withSpan(
            "ord.metadata.compile",
            {
                "ord.id": req.params?.ordId,
                "ord.service": req.params?.service,
            },
            () => compileMetadata(req.path, model),
        );
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
        cds.app.get(`${this.path}`, recordRequest, async (req, res) => {
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
                            : ord(
                                  await resolveCdsModel(DOCUMENT_PERSPECTIVES.SystemInstance, tenant),
                                  extensions,
                              ),
                    ),
                );
        });

        cds.app.get(
            `/ord/v1/documents/ord-document`,
            [recordRequest, authMiddleware, validationMiddleware],
            async (req, res) => {
                const part = req.query.part || 0;
                const tenant = req.headers[LOCAL_TENANT_ID_HEADER_KEY];
                const perspective = req.query.perspective || DOCUMENT_PERSPECTIVES.SystemVersion;
                const model = await resolveCdsModel(perspective, tenant);
                const extensions = Array.from(Object.values(this.extensions));
                const document = defaults.adjustForPerspective(ord(model, extensions), perspective);
                const slices = slice(document, defaults.sizeLimit);

                if (isNaN(part) || part < 0 || part >= slices.length) {
                    return res.status(400).send(`Required query parameter 'part' is invalid`);
                }

                return res.status(200).send(slices[part]);
            },
        );

        cds.app.get(
            `/ord/v1/documents/:id`,
            [recordRequest, authMiddleware, validationMiddleware],
            async (_, res) => {
                return res.status(404).send("404 Not Found");
            },
        );

        // Use separate routes instead of optional parameters for path-to-regexp v8 compatibility
        cds.app.get(
            `/ord/v1/:ordId/:service`,
            [recordRequest, authMiddleware, validationMiddleware],
            metadataResponseHandler,
        );
        cds.app.get(
            `/ord/v1/:ordId`,
            [recordRequest, authMiddleware, validationMiddleware],
            metadataResponseHandler,
        );
        cds.app.get(`/ord/v1`, [recordRequest, authMiddleware, validationMiddleware], metadataResponseHandler);

        return super.init();
    }

    // eslint-disable-next-line no-unused-vars
    static resolveFeatureToggles(tenant) {
        return ["*"];
    }
}

module.exports = { OpenResourceDiscoveryService };
