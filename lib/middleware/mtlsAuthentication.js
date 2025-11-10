const { Logger } = require("../logger");
const { createSapCfMtlsMiddleware } = require("./sapCfMtlsHandler");

/**
 * Main mTLS Authentication Middleware
 * Handles different mTLS modes and configurations
 */
class MtlsAuthentication {
    constructor(mtlsConfig) {
        this.config = mtlsConfig || {};
        this.middleware = null;
        this.initialized = false;
    }

    /**
     * Initialize the mTLS authentication middleware
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            const mode = this.config.mode || "sap:cmp-mtls";

            if (mode === "sap:cmp-mtls") {
                this.middleware = createSapCfMtlsMiddleware(this.config);
                Logger.log("mTLS Authentication: SAP CF mode initialized");
            } else {
                throw new Error(`Unsupported mTLS mode: ${mode}. Only 'sap:cmp-mtls' is supported.`);
            }

            this.initialized = true;
        } catch (error) {
            Logger.error("mTLS Authentication initialization failed:", error.message);
            throw error;
        }
    }

    /**
     * Get the Express middleware function
     * @returns {Promise<Function>} Express middleware
     */
    async getMiddleware() {
        await this.initialize();
        return this.middleware;
    }

    /**
     * Validate mTLS configuration
     * @param {Object} config - mTLS configuration to validate
     * @returns {Object} Validation result
     */
    static validateConfig(config) {
        const errors = [];

        if (!config) {
            errors.push("mTLS configuration is required");
            return { isValid: false, errors };
        }

        // Validate mode
        const mode = config.mode || "sap:cmp-mtls";
        if (mode !== "sap:cmp-mtls") {
            errors.push(`Unsupported mTLS mode: ${mode}. Only 'sap:cmp-mtls' is supported.`);
        }

        // For SAP CF mode, check if we have at least some configuration
        if (mode === "sap:cmp-mtls") {
            const hasTrustedIssuers = config.trustedIssuers && config.trustedIssuers.length > 0;
            const hasTrustedSubjects = config.trustedSubjects && config.trustedSubjects.length > 0;
            const hasConfigEndpoints = config.configEndpoints && config.configEndpoints.length > 0;
            const hasCaChainFile = config.caChainFile;

            if (!hasTrustedIssuers && !hasTrustedSubjects && !hasConfigEndpoints && !hasCaChainFile) {
                errors.push(
                    "SAP CF mTLS mode requires at least one of: trustedIssuers, trustedSubjects, configEndpoints, or caChainFile",
                );
            }

            // Validate arrays if provided
            if (config.trustedIssuers && !Array.isArray(config.trustedIssuers)) {
                errors.push("trustedIssuers must be an array");
            }

            if (config.trustedSubjects && !Array.isArray(config.trustedSubjects)) {
                errors.push("trustedSubjects must be an array");
            }

            if (config.configEndpoints && !Array.isArray(config.configEndpoints)) {
                errors.push("configEndpoints must be an array");
            }

            // Validate strings in arrays - only if they are actually arrays
            if (config.trustedIssuers && Array.isArray(config.trustedIssuers)) {
                config.trustedIssuers.forEach((issuer, index) => {
                    if (typeof issuer !== "string" || issuer.trim() === "") {
                        errors.push(`trustedIssuers[${index}] must be a non-empty string`);
                    }
                });
            }

            if (config.trustedSubjects && Array.isArray(config.trustedSubjects)) {
                config.trustedSubjects.forEach((subject, index) => {
                    if (typeof subject !== "string" || subject.trim() === "") {
                        errors.push(`trustedSubjects[${index}] must be a non-empty string`);
                    }
                });
            }

            if (config.configEndpoints && Array.isArray(config.configEndpoints)) {
                config.configEndpoints.forEach((endpoint, index) => {
                    if (typeof endpoint !== "string" || endpoint.trim() === "") {
                        errors.push(`configEndpoints[${index}] must be a non-empty string`);
                    }
                });
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }
}

/**
 * Create mTLS authentication middleware
 * @param {Object} mtlsConfig - mTLS configuration from .cdsrc.json
 * @returns {Promise<Function>} Express middleware function
 */
async function createMtlsAuthMiddleware(mtlsConfig) {
    const auth = new MtlsAuthentication(mtlsConfig);
    return await auth.getMiddleware();
}

/**
 * Validate mTLS configuration
 * @param {Object} mtlsConfig - mTLS configuration to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
function validateMtlsConfig(mtlsConfig) {
    return MtlsAuthentication.validateConfig(mtlsConfig);
}

/**
 * Create a simple mTLS test middleware (for development/testing)
 * @returns {Function} Express middleware that logs and continues
 */
function createMtlsTestMiddleware() {
    return (req, res, next) => {
        Logger.log("mTLS Test Middleware: Processing request");
        Logger.log("Headers:", JSON.stringify(req.headers, null, 2));

        // Mark as authenticated for testing
        req.isMtlsAuthenticated = true;
        req.clientCertificate = {
            subject: { CN: "test-client", DN: "CN=test-client,O=Test,C=US" },
            issuer: { DN: "CN=Test CA,O=Test,C=US" },
        };

        next();
    };
}

/**
 * Check if request is authenticated via mTLS
 * @param {Object} req - Express request object
 * @returns {boolean} True if authenticated via mTLS
 */
function isMtlsAuthenticated(req) {
    return req && req.isMtlsAuthenticated === true;
}

/**
 * Get client certificate information from request
 * @param {Object} req - Express request object
 * @returns {Object|null} Client certificate information or null
 */
function getClientCertificateInfo(req) {
    return req && req.clientCertificate ? req.clientCertificate : null;
}

module.exports = {
    MtlsAuthentication,
    createMtlsAuthMiddleware,
    validateMtlsConfig,
    createMtlsTestMiddleware,
    isMtlsAuthenticated,
    getClientCertificateInfo,
};
