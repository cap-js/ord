const cds = require("@sap/cds");
const path = require("path");

// Get the app's cds instance via process.cwd() to handle multiple CDS installations
let appCds = cds;
try {
    const appCdsPath = path.join(process.cwd(), "node_modules", "@sap", "cds");
    appCds = require(appCdsPath);
} catch {
    // Fallback to local cds instance
}

if (cds.cli.command === "build") {
    cds.build?.register?.("ord", require("./lib/build"));
}

function _lazyRegisterCompileTarget() {
    const ord = require("./lib/index").ord;
    Object.defineProperty(this, "ord", { ord });
    return ord;
}

const registerORDCompileTarget = () => {
    Object.defineProperty(cds.compile.to, "ord", {
        get: _lazyRegisterCompileTarget,
        configurable: true,
    });
};

registerORDCompileTarget();

// Register ORD routes at bootstrap - the app parameter is passed directly by CDS
const registerOrdRoutes = (app) => {
    if (!app || app._ordRoutesRegistered) return;
    app._ordRoutesRegistered = true;

    const ord = require("./lib/ord.js");
    const getMetadata = require("./lib/metaData.js");
    const defaults = require("./lib/defaults.js");
    const { createAuthConfig, createAuthMiddleware } = require("./lib/auth/authentication.js");
    const Logger = require("./lib/logger.js");

    const authConfig = createAuthConfig();
    if (authConfig.error) {
        Logger.error(`Authentication initialization failed: ${authConfig.error}`);
        return;
    }

    const authMiddleware = createAuthMiddleware(authConfig);

    app.get(`/.well-known/open-resource-discovery`, (_, res) => {
        return res.status(200).send(defaults.baseTemplate(authConfig));
    });

    app.get(`/ord/v1/documents/ord-document`, authMiddleware, async (_, res) => {
        const csn = appCds.context?.model || appCds.model;
        const data = ord(csn);
        return res.status(200).send(data);
    });

    app.get(`/ord/v1/documents/:id`, authMiddleware, async (_, res) => {
        return res.status(404).send("404 Not Found");
    });

    const metadataHandler = async (req, res) => {
        try {
            const { contentType, response } = await getMetadata(req.url);
            return res.status(200).contentType(contentType).send(response);
        } catch (error) {
            Logger.error(error, "Error while processing the resource definition document");
            return res.status(500).send(error.message);
        }
    };

    app.get(`/ord/v1/:ordId/:service`, authMiddleware, metadataHandler);
    app.get(`/ord/v1/:ordId`, authMiddleware, metadataHandler);
    app.get(`/ord/v1`, authMiddleware, metadataHandler);
};

// Bootstrap event receives Express app as parameter - register on app's cds instance
appCds.on("bootstrap", registerOrdRoutes);
