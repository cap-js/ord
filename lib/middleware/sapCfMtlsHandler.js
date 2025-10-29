const { Logger } = require("../logger");
const {
    extractCertificateFromHeader,
    parseCertificateFromPem,
    tokenizeDn,
    dnTokensMatch,
    isBase64Encoded,
} = require("./certificateHelpers");
const { getCertificateLoader } = require("./certificateLoader");
const { createCertificateValidator } = require("./certificateValidator");

/**
 * SAP Cloud Foundry mTLS Handler
 * Processes platform headers and validates certificates
 */
class SapCfMtlsHandler {
    constructor(mtlsConfig) {
        this.config = mtlsConfig || {};
        this.certificateValidator = null;
        this.initialized = false;
    }

    /**
     * Initialize the handler with certificate validation services
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            if (this.config.caChainFile) {
                const loader = await getCertificateLoader(this.config.caChainFile);
                this.certificateValidator = createCertificateValidator(loader);
                Logger.log("SAP CF mTLS: Certificate validator initialized");
            } else {
                Logger.log("SAP CF mTLS: No CA chain configured - using basic header validation only");
            }

            this.initialized = true;
        } catch (error) {
            Logger.error("SAP CF mTLS: Failed to initialize certificate validation services:", error.message);
            // Continue without full validation - basic header checks will still work
            this.initialized = true;
        }
    }

    /**
     * Validate mTLS request from SAP CF headers
     * @param {Object} headers - Request headers
     * @returns {Promise<Object>} Validation result
     */
    async validateMtlsRequest(headers) {
        try {
            await this.initialize();

            Logger.log("SAP CF mTLS: Starting validation with headers:", Object.keys(headers));

            // Step 1: Check HAProxy verification status
            const verifyStatus = headers["x-ssl-client-verify"];
            Logger.log(`SAP CF mTLS: Verification status: ${verifyStatus}`);
            if (verifyStatus !== "0") {
                return {
                    isValid: false,
                    error: `SAP CF mTLS: Client certificate verification failed. Status: ${verifyStatus}`,
                };
            }

            // Step 2: Extract and decode certificate details
            const certInfo = this._extractCertificateInfo(headers);
            if (!certInfo) {
                return {
                    isValid: false,
                    error: "SAP CF mTLS: Failed to extract certificate information from headers",
                };
            }

            // Step 3: Validate against trusted lists if configured
            const trustedValidation = this._validateTrustedCertificate(certInfo);
            if (!trustedValidation.isValid) {
                return trustedValidation;
            }

            // Step 4: Perform full certificate validation if validator is available
            if (this.certificateValidator) {
                const fullValidation = await this._performFullCertificateValidation(headers);
                if (!fullValidation.isValid) {
                    return fullValidation;
                }
            }

            return {
                isValid: true,
                certificateInfo: certInfo,
            };
        } catch (error) {
            Logger.error("SAP CF mTLS: Error during validation:", error.message);
            return {
                isValid: false,
                error: `SAP CF mTLS: Validation error: ${error.message}`,
            };
        }
    }

    /**
     * Extract certificate information from SAP CF headers
     * @private
     * @param {Object} headers - Request headers
     * @returns {Object|null} Certificate information
     */
    _extractCertificateInfo(headers) {
        try {
            let subjectDn = headers["x-ssl-client-subject-dn"];
            let subjectCn = headers["x-ssl-client-subject-cn"];
            let issuerDn = headers["x-ssl-client-issuer-dn"];
            let rootCaDn = headers["x-ssl-client-root-ca-dn"];

            // Decode base64 if needed
            if (this.config.decodeBase64Headers !== false) {
                if (subjectDn && isBase64Encoded(subjectDn)) {
                    subjectDn = Buffer.from(subjectDn, "base64").toString("ascii");
                }
                if (subjectCn && isBase64Encoded(subjectCn)) {
                    subjectCn = Buffer.from(subjectCn, "base64").toString("ascii");
                }
                if (issuerDn && isBase64Encoded(issuerDn)) {
                    issuerDn = Buffer.from(issuerDn, "base64").toString("ascii");
                }
                if (rootCaDn && isBase64Encoded(rootCaDn)) {
                    rootCaDn = Buffer.from(rootCaDn, "base64").toString("ascii");
                }
            }

            return {
                subject: {
                    DN: subjectDn,
                    CN: subjectCn,
                },
                issuer: {
                    DN: issuerDn,
                },
                rootCA: {
                    DN: rootCaDn,
                },
                sessionId: headers["x-ssl-client-session-id"],
                notBefore: headers["x-ssl-client-notbefore"],
                notAfter: headers["x-ssl-client-notafter"],
            };
        } catch (error) {
            Logger.error("SAP CF mTLS: Failed to extract certificate info:", error.message);
            return null;
        }
    }

    /**
     * Validate certificate against trusted issuers and subjects
     * @private
     * @param {Object} certInfo - Certificate information
     * @returns {Object} Validation result
     */
    _validateTrustedCertificate(certInfo) {
        Logger.log("SAP CF mTLS: Validating trusted certificate");
        Logger.log("SAP CF mTLS: Certificate info:", JSON.stringify(certInfo, null, 2));
        Logger.log("SAP CF mTLS: Trusted subjects config:", this.config.trustedSubjects);
        Logger.log("SAP CF mTLS: Trusted issuers config:", this.config.trustedIssuers);

        // Validate subject if trusted subjects are configured
        if (this.config.trustedSubjects && this.config.trustedSubjects.length > 0 && certInfo.subject.DN) {
            Logger.log(`SAP CF mTLS: Validating subject: ${certInfo.subject.DN}`);
            const subjectTokens = tokenizeDn(certInfo.subject.DN);
            Logger.log("SAP CF mTLS: Subject tokens:", subjectTokens);
            
            const isTrustedSubject = this.config.trustedSubjects.some((trustedSubject) => {
                const trustedTokens = tokenizeDn(trustedSubject);
                const matches = dnTokensMatch(subjectTokens, trustedTokens);
                Logger.log(`SAP CF mTLS: Comparing with trusted subject: ${trustedSubject}`);
                Logger.log("SAP CF mTLS: Trusted tokens:", trustedTokens);
                Logger.log("SAP CF mTLS: Tokens match:", matches);
                return matches;
            });

            Logger.log("SAP CF mTLS: Is trusted subject:", isTrustedSubject);
            if (!isTrustedSubject) {
                return {
                    isValid: false,
                    error: `SAP CF mTLS: Certificate subject not trusted. Subject: ${certInfo.subject.DN}`,
                };
            }
        }

        // Validate issuer if trusted issuers are configured
        if (this.config.trustedIssuers && this.config.trustedIssuers.length > 0 && certInfo.issuer.DN) {
            Logger.log(`SAP CF mTLS: Validating issuer: ${certInfo.issuer.DN}`);
            const issuerTokens = tokenizeDn(certInfo.issuer.DN);
            Logger.log("SAP CF mTLS: Issuer tokens:", issuerTokens);
            
            const isTrustedIssuer = this.config.trustedIssuers.some((trustedIssuer) => {
                const trustedTokens = tokenizeDn(trustedIssuer);
                const matches = dnTokensMatch(issuerTokens, trustedTokens);
                Logger.log(`SAP CF mTLS: Comparing with trusted issuer: ${trustedIssuer}`);
                Logger.log("SAP CF mTLS: Trusted tokens:", trustedTokens);
                Logger.log("SAP CF mTLS: Tokens match:", matches);
                return matches;
            });

            Logger.log("SAP CF mTLS: Is trusted issuer:", isTrustedIssuer);
            if (!isTrustedIssuer) {
                return {
                    isValid: false,
                    error: `SAP CF mTLS: Certificate issuer not trusted. Issuer: ${certInfo.issuer.DN}`,
                };
            }
        }

        Logger.log("SAP CF mTLS: Trusted certificate validation passed");
        return { isValid: true };
    }

    /**
     * Perform full certificate validation using certificate validator
     * @private
     * @param {Object} headers - Request headers
     * @returns {Promise<Object>} Validation result
     */
    async _performFullCertificateValidation(headers) {
        try {
            const certHeader = headers["x-forwarded-client-cert"];
            if (!certHeader) {
                return {
                    isValid: false,
                    error: "SAP CF mTLS: Missing x-forwarded-client-cert header for full validation",
                };
            }

            const pemCert = extractCertificateFromHeader(certHeader);
            if (!pemCert) {
                return {
                    isValid: false,
                    error: "SAP CF mTLS: Failed to extract certificate from header",
                };
            }

            const parsedCert = parseCertificateFromPem(pemCert);
            if (!parsedCert) {
                return {
                    isValid: false,
                    error: "SAP CF mTLS: Failed to parse certificate",
                };
            }

            const validationResult = await this.certificateValidator.validateCertificate(parsedCert);

            if (!validationResult.isValid) {
                return {
                    isValid: false,
                    error: `SAP CF mTLS: Full certificate validation failed. ${validationResult.error}`,
                };
            }

            return { isValid: true };
        } catch (error) {
            return {
                isValid: false,
                error: `SAP CF mTLS: Full validation error: ${error.message}`,
            };
        }
    }
}

/**
 * Create SAP CF mTLS handler instance
 * @param {Object} mtlsConfig - mTLS configuration
 * @returns {SapCfMtlsHandler} Handler instance
 */
function createSapCfMtlsHandler(mtlsConfig) {
    return new SapCfMtlsHandler(mtlsConfig);
}

/**
 * Create mTLS middleware for SAP CF
 * @param {Object} mtlsConfig - mTLS configuration
 * @returns {Function} Express middleware function
 */
function createSapCfMtlsMiddleware(mtlsConfig) {
    const handler = createSapCfMtlsHandler(mtlsConfig);

    return async (req, res, next) => {
        try {
            const validationResult = await handler.validateMtlsRequest(req.headers);

            if (validationResult.isValid) {
                // Store certificate information in request
                req.clientCertificate = validationResult.certificateInfo;
                req.isMtlsAuthenticated = true;
                Logger.log(`SAP CF mTLS: Client certificate authorized. Subject CN: ${validationResult.certificateInfo?.subject?.CN}`);
                return next();
            } else {
                Logger.error("SAP CF mTLS validation failed:", validationResult.error);
                req.isMtlsAuthenticated = false;
                return res.status(401).send(validationResult.error || "mTLS authentication failed");
            }
        } catch (error) {
            Logger.error("SAP CF mTLS: Unexpected error:", error.message);
            req.isMtlsAuthenticated = false;
            return res.status(500).send("Internal server error during mTLS authentication");
        }
    };
}

module.exports = {
    SapCfMtlsHandler,
    createSapCfMtlsHandler,
    createSapCfMtlsMiddleware,
};
