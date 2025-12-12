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
        // Now using async initialization with CF mTLS validator creation
        try {
            await authentication.getAuthConfig();
            Logger.info("Authentication configuration initialized successfully");
        } catch (error) {
            Logger.error("Failed to initialize authentication configuration:", error.message);
            throw error; // Fail service startup if auth config is invalid
        }

        cds.app.get(`${this.path}`, (req, res) => {
            // ==================== REQUEST CONTENT LOGGING ====================
            const isGorouter =
                req.headers["x-forwarded-client-cert"] ||
                req.headers["x-forwarded-client-cert-chain"] ||
                req.headers["x-forwarded-client-cert-info"];
            const isUCL =
                req.headers["user-agent"]?.includes("UCL") || req.url?.includes("ucl") || req.headers["x-ucl-request"];

            if (isGorouter || isUCL) {
                console.log("=".repeat(80));
                console.log(`[${new Date().toISOString()}] ORD BASE ENDPOINT REQUEST`);
                console.log(`Source: ${isGorouter ? "GOROUTER" : ""} ${isUCL ? "UCL" : ""}`);
                console.log(`Method: ${req.method}`);
                console.log(`URL: ${req.url}`);
                console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
                console.log("=".repeat(80));
            }
            // ==================== END REQUEST CONTENT LOGGING ====================
            return res.status(200).send(defaults.baseTemplate);
        });

        cds.app.get(`/ord/v1/documents/ord-document`, authentication.authenticate, async (req, res) => {
            // ==================== REQUEST CONTENT LOGGING ====================
            const isGorouter =
                req.headers["x-forwarded-client-cert"] ||
                req.headers["x-forwarded-client-cert-chain"] ||
                req.headers["x-forwarded-client-cert-info"];
            const isUCL =
                req.headers["user-agent"]?.includes("UCL") || req.url?.includes("ucl") || req.headers["x-ucl-request"];

            if (isGorouter || isUCL) {
                console.log("=".repeat(80));
                console.log(`[${new Date().toISOString()}] ORD DOCUMENT REQUEST`);
                console.log(`Source: ${isGorouter ? "GOROUTER" : ""} ${isUCL ? "UCL" : ""}`);
                console.log(`Method: ${req.method}`);
                console.log(`URL: ${req.url}`);
                console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
                console.log("=".repeat(80));
            }
            // ==================== END REQUEST CONTENT LOGGING ====================
            const csn = cds.context?.model || cds.model;
            const data = ord(csn);
            return res.status(200).send(data);
        });

        cds.app.get(`/ord/v1/documents/:id`, authentication.authenticate, async (req, res) => {
            // ==================== REQUEST CONTENT LOGGING ====================
            const isGorouter =
                req.headers["x-forwarded-client-cert"] ||
                req.headers["x-forwarded-client-cert-chain"] ||
                req.headers["x-forwarded-client-cert-info"];
            const isUCL =
                req.headers["user-agent"]?.includes("UCL") || req.url?.includes("ucl") || req.headers["x-ucl-request"];

            if (isGorouter || isUCL) {
                console.log("=".repeat(80));
                console.log(`[${new Date().toISOString()}] ORD DOCUMENT BY ID REQUEST`);
                console.log(`Source: ${isGorouter ? "GOROUTER" : ""} ${isUCL ? "UCL" : ""}`);
                console.log(`Method: ${req.method}`);
                console.log(`URL: ${req.url}`);
                console.log(`Document ID: ${req.params.id}`);
                console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
                console.log("=".repeat(80));
            }
            // ==================== END REQUEST CONTENT LOGGING ====================
            return res.status(404).send("404 Not Found");
        });

        cds.app.get(`/ord/v1/:ordId?/:service?`, authentication.authenticate, async (req, res) => {
            // ==================== REQUEST CONTENT LOGGING ====================
            const isGorouter =
                req.headers["x-forwarded-client-cert"] ||
                req.headers["x-forwarded-client-cert-chain"] ||
                req.headers["x-forwarded-client-cert-info"];
            const isUCL =
                req.headers["user-agent"]?.includes("UCL") || req.url?.includes("ucl") || req.headers["x-ucl-request"];

            if (isGorouter || isUCL) {
                console.log("=".repeat(80));
                console.log(`[${new Date().toISOString()}] ORD METADATA REQUEST`);
                console.log(`Source: ${isGorouter ? "GOROUTER" : ""} ${isUCL ? "UCL" : ""}`);
                console.log(`Method: ${req.method}`);
                console.log(`URL: ${req.url}`);
                console.log(`ORD ID: ${req.params.ordId}`);
                console.log(`Service: ${req.params.service}`);
                console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
                console.log("=".repeat(80));
            }
            // ==================== END REQUEST CONTENT LOGGING ====================
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
