const { Logger } = require("../logger");

/**
 * Certificate Validator class for validating X.509 certificates
 */
class CertificateValidator {
    constructor(certificateLoader) {
        this.certificateLoader = certificateLoader;
    }

    /**
     * Validate a certificate using 3-step process
     * @param {Object} certificate - Parsed certificate object
     * @returns {Promise<Object>} Validation result
     */
    async validateCertificate(certificate) {
        const result = {
            isValid: false,
            details: {},
        };

        try {
            // Step 1: Check time validity
            const timeValidation = this._validateCertificateTime(certificate);
            result.details.timeValid = timeValidation.isValid;
            if (!timeValidation.isValid) {
                result.error = timeValidation.error;
                return result;
            }

            // Step 2: Build and validate certificate chain
            const chainValidation = this._validateCertificateChain(certificate);
            result.details.chainValid = chainValidation.isValid;
            if (!chainValidation.isValid) {
                result.error = chainValidation.error;
                return result;
            }

            // All validations passed
            result.isValid = true;
            return result;
        } catch (error) {
            result.error = `Validation error: ${error.message}`;
            return result;
        }
    }

    /**
     * Validate certificate time bounds with grace period
     * @private
     * @param {Object} cert - Parsed certificate object
     * @returns {Object} Time validation result
     */
    _validateCertificateTime(cert) {
        if (!cert || !cert.validFrom || !cert.validTo) {
            return {
                isValid: false,
                error: "Certificate missing validity dates",
            };
        }

        const now = new Date();
        const validFrom = new Date(cert.validFrom);
        const validTo = new Date(cert.validTo);

        // Add 5-minute grace period for clock skew
        const graceMinutes = 5;
        const gracePeriod = graceMinutes * 60 * 1000;
        const nowWithGrace = new Date(now.getTime() - gracePeriod);
        const nowWithFutureGrace = new Date(now.getTime() + gracePeriod);

        if (nowWithGrace < validFrom) {
            return {
                isValid: false,
                error: `Certificate not yet valid. Valid from: ${validFrom.toISOString()}`,
            };
        }

        if (nowWithFutureGrace > validTo) {
            return {
                isValid: false,
                error: `Certificate expired. Valid until: ${validTo.toISOString()}`,
            };
        }

        return { isValid: true };
    }

    /**
     * Validate certificate chain
     * @private
     * @param {Object} cert - Parsed certificate object
     * @returns {Object} Chain validation result
     */
    _validateCertificateChain(cert) {
        try {
            const chain = this._buildCertificateChain(cert);

            if (!chain.root) {
                return {
                    isValid: false,
                    error: "Certificate chain does not terminate at a trusted root CA",
                };
            }

            // Validate each link in the chain
            const currentCert = cert.x509;
            const certPath = [currentCert, ...chain.intermediates.map((c) => c.x509)];

            if (chain.root) {
                certPath.push(chain.root.x509);
            }

            for (let i = 0; i < certPath.length - 1; i++) {
                const subject = certPath[i];
                const issuer = certPath[i + 1];

                if (!this._verifyCertificateSignature(subject, issuer)) {
                    return {
                        isValid: false,
                        error: `Invalid signature in certificate chain at level ${i + 1}`,
                    };
                }
            }

            return { isValid: true };
        } catch (error) {
            return {
                isValid: false,
                error: `Chain validation error: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    /**
     * Build certificate chain from client to root CA
     * @private
     * @param {Object} cert - Parsed certificate object
     * @returns {Object} Certificate chain
     */
    _buildCertificateChain(cert) {
        const chain = {
            clientCert: cert,
            intermediates: [],
        };

        let currentCert = cert.x509;
        const maxDepth = 10;
        let depth = 0;

        while (depth < maxDepth) {
            // Check if self-signed (root CA)
            if (currentCert.issuer === currentCert.subject) {
                // Check if it's a trusted root
                const trustedRoot = this.certificateLoader.getCertificateBySubject(currentCert.subject);
                if (trustedRoot && this._certificatesMatch(currentCert, trustedRoot)) {
                    chain.root = {
                        raw: trustedRoot.toString(),
                        x509: trustedRoot,
                        subject: { DN: trustedRoot.subject },
                        issuer: { DN: trustedRoot.issuer },
                        serialNumber: trustedRoot.serialNumber,
                        validFrom: new Date(trustedRoot.validFrom),
                        validTo: new Date(trustedRoot.validTo),
                        fingerprint: trustedRoot.fingerprint,
                    };
                }
                break;
            }

            // Find issuer certificate
            const issuerCert = this.certificateLoader.getCertificateBySubject(currentCert.issuer);
            if (!issuerCert) {
                Logger.log(`Could not find issuer certificate for: ${currentCert.issuer}`);
                break;
            }

            // Add to intermediates
            chain.intermediates.push({
                raw: issuerCert.toString(),
                x509: issuerCert,
                subject: { DN: issuerCert.subject },
                issuer: { DN: issuerCert.issuer },
                serialNumber: issuerCert.serialNumber,
                validFrom: new Date(issuerCert.validFrom),
                validTo: new Date(issuerCert.validTo),
                fingerprint: issuerCert.fingerprint,
            });

            currentCert = issuerCert;
            depth++;
        }

        return chain;
    }

    /**
     * Verify certificate signature
     * @private
     * @param {crypto.X509Certificate} subject - Subject certificate
     * @param {crypto.X509Certificate} issuer - Issuer certificate
     * @returns {boolean} True if signature is valid
     */
    _verifyCertificateSignature(subject, issuer) {
        try {
            return subject.verify(issuer.publicKey);
        } catch (error) {
            Logger.log(`Signature verification failed: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Check if two certificates match by fingerprint
     * @private
     * @param {crypto.X509Certificate} cert1 - First certificate
     * @param {crypto.X509Certificate} cert2 - Second certificate
     * @returns {boolean} True if certificates match
     */
    _certificatesMatch(cert1, cert2) {
        return cert1.fingerprint === cert2.fingerprint;
    }
}

/**
 * Create certificate validator instance
 * @param {Object} certificateLoader - Certificate loader instance
 * @returns {CertificateValidator} Validator instance
 */
function createCertificateValidator(certificateLoader) {
    return new CertificateValidator(certificateLoader);
}

module.exports = {
    CertificateValidator,
    createCertificateValidator,
};
