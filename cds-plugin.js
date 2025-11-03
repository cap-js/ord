const cds = require("@sap/cds");
const { getAuthConfig, authenticate } = require("./lib/authentication");

if (cds.cli.command === "build") {
    cds.build?.register?.("ord", require("./lib/build"));
}

// load auth config before any service is started
cds.on("bootstrap", async (app) => {
    getAuthConfig();
    
    // Register ORD routes when Express app is available
    if (app) {
        const { ord, getMetadata, defaults, Logger } = require("./lib/index.js");
        const logger = Logger.Logger;
        
        app.get('/.well-known/open-resource-discovery', authenticate, (_, res) => {
            return res.status(200).send(defaults.baseTemplate);
        });

        app.get('/ord/v1/documents/ord-document', authenticate, async (_, res) => {
            const csn = cds.context?.model || cds.model;
            const data = ord(csn);
            return res.status(200).send(data);
        });

        app.get('/ord/v1/documents/:id', authenticate, async (_, res) => {
            return res.status(404).send("404 Not Found");
        });

        app.get('/ord/v1/:ordId?/:service?', authenticate, async (req, res) => {
            try {
                const { contentType, response } = await getMetadata(req.url);
                return res.status(200).contentType(contentType).send(response);
            } catch (error) {
                logger.error(error, "Error while processing the resource definition document");
                return res.status(500).send(error.message);
            }
        });
    }
});

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
