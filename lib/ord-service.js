const cds = require("@sap/cds");
const { ord, getMetadata, defaults, authentication, Logger } = require("./index.js");

// ==================== Temporary Debug Code Start ====================
// Log buffer - unlimited length
const logs = [];

// Intercept Logger.info to capture all ORD plugin INFO logs
const originalInfo = Logger.info;
Logger.info = function (...args) {
    logs.push({
        time: new Date().toISOString(),
        message: args.join(" "),
    });
    return originalInfo.apply(this, args);
};
// ==================== Temporary Debug Code End ====================

class OpenResourceDiscoveryService extends cds.ApplicationService {
    async init() {
        // Initialize authentication configuration on service startup
        // This ensures the config is loaded from .cdsrc.json or environment variables
        // before any requests are processed
        // Now using synchronous initialization with module-level caching
        try {
            authentication.getAuthConfig();
            Logger.info("Authentication configuration initialized successfully");
        } catch (error) {
            Logger.error("Failed to initialize authentication configuration:", error.message);
            throw error; // Fail service startup if auth config is invalid
        }

        cds.app.get(`${this.path}`, (_, res) => {
            return res.status(200).send(defaults.baseTemplate);
        });

        cds.app.get(`/ord/v1/documents/ord-document`, authentication.authenticate, async (_, res) => {
            const csn = cds.context?.model || cds.model;
            const data = ord(csn);
            return res.status(200).send(data);
        });

        cds.app.get(`/ord/v1/documents/:id`, authentication.authenticate, async (_, res) => {
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

        // ==================== Temporary Debug Endpoint ====================
        // Debug endpoint to view all captured ORD plugin logs
        cds.app.get("/log", (req, res) => {
            res.json({
                timestamp: new Date().toISOString(),
                totalLogs: logs.length,
                logs: logs,
            });
        });
        // ==================== Temporary Debug Endpoint End ====================

        return super.init();
    }
}

module.exports = { OpenResourceDiscoveryService };
