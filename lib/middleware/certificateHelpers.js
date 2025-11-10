const crypto = require("crypto");
const { Logger } = require("../logger");

/**
 * Tokenize a Distinguished Name (DN) string into components
 * Supports both comma and slash separators
 * @param {string} dn - Distinguished Name string
 * @returns {string[]} Array of DN components
 */
function tokenizeDn(dn) {
    if (!dn || typeof dn !== "string") {
        return [];
    }

    // Remove leading slash if present
    const cleanDn = dn.startsWith("/") ? dn.substring(1) : dn;

    // Split by either comma or slash, then filter out empty strings
    const tokens = cleanDn
        .split(/[,/]/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0);

    return tokens;
}

/**
 * Check if two sets of DN tokens match (order-independent)
 * @param {string[]} tokens1 - First set of DN tokens
 * @param {string[]} tokens2 - Second set of DN tokens
 * @returns {boolean} True if tokens match
 */
function dnTokensMatch(tokens1, tokens2) {
    if (!Array.isArray(tokens1) || !Array.isArray(tokens2)) {
        return false;
    }

    if (tokens1.length !== tokens2.length) {
        return false;
    }

    // Sort tokens to make comparison order-independent
    const sorted1 = [...tokens1].sort();
    const sorted2 = [...tokens2].sort();

    return sorted1.every((token, index) => token === sorted2[index]);
}

/**
 * Parse Distinguished Name string into structured object
 * @param {string} dnString - DN string to parse
 * @returns {Object} Parsed DN object with individual components
 */
function parseDnString(dnString) {
    const subject = { DN: dnString };

    if (!dnString) {
        return subject;
    }

    const parts = dnString.split(/,(?=\w+=)/);
    parts.forEach((part) => {
        const [key, ...valueParts] = part.trim().split("=");
        const value = valueParts.join("=");

        switch (key) {
            case "CN":
                subject.CN = value;
                break;
            case "O":
                subject.O = value;
                break;
            case "OU":
                subject.OU = value;
                break;
            case "C":
                subject.C = value;
                break;
            case "L":
                subject.L = value;
                break;
            case "ST":
                subject.ST = value;
                break;
        }
    });

    return subject;
}

/**
 * Extract certificate from x-forwarded-client-cert header
 * @param {string} headerValue - Header value containing certificate
 * @returns {string|null} PEM formatted certificate or null
 */
function extractCertificateFromHeader(headerValue) {
    if (!headerValue) {
        return null;
    }

    try {
        // Handle x-forwarded-client-cert format
        const certMatch = headerValue.match(/Cert="([^"]+)"/i);
        if (certMatch) {
            const urlEncodedCert = certMatch[1];
            const decodedCert = decodeURIComponent(urlEncodedCert);
            return formatPemCertificate(decodedCert);
        }

        // Handle direct base64 encoded certificate
        if (isBase64(headerValue) && headerValue.length > 20) {
            try {
                const decoded = Buffer.from(headerValue, "base64").toString("utf-8");
                // Only return if the decoded content looks like a certificate
                if (decoded.includes("BEGIN CERTIFICATE") || decoded.includes("END CERTIFICATE")) {
                    return formatPemCertificate(decoded);
                }
            } catch {
                // If base64 decoding fails, continue to return null
            }
        }

        return null;
    } catch (error) {
        Logger.error("extractCertificateFromHeader:", `Failed to extract certificate: ${error.message}`);
        return null;
    }
}

/**
 * Parse certificate from PEM string
 * @param {string} pemString - PEM formatted certificate
 * @returns {Object|null} Parsed certificate object or null
 */
function parseCertificateFromPem(pemString) {
    try {
        const x509 = new crypto.X509Certificate(pemString);

        return {
            raw: pemString,
            x509,
            subject: parseDnString(x509.subject),
            issuer: parseDnString(x509.issuer),
            serialNumber: x509.serialNumber,
            validFrom: new Date(x509.validFrom),
            validTo: new Date(x509.validTo),
            fingerprint: x509.fingerprint,
        };
    } catch (error) {
        Logger.error("parseCertificateFromPem:", `Failed to parse certificate: ${error.message}`);
        return null;
    }
}

/**
 * Format certificate as PEM
 * @param {string} cert - Certificate string
 * @returns {string} PEM formatted certificate
 */
function formatPemCertificate(cert) {
    if (!cert) {
        return cert;
    }

    let formattedCert = cert.trim();

    if (!formattedCert.includes("-----BEGIN CERTIFICATE-----")) {
        formattedCert = `-----BEGIN CERTIFICATE-----\n${formattedCert}\n-----END CERTIFICATE-----`;
    }

    // Ensure proper line breaks
    formattedCert = formattedCert.replace(/-----BEGIN CERTIFICATE-----/g, "-----BEGIN CERTIFICATE-----\n");
    formattedCert = formattedCert.replace(/-----END CERTIFICATE-----/g, "\n-----END CERTIFICATE-----");

    return formattedCert;
}

/**
 * Check if a string is base64 encoded
 * @param {string} str - String to check
 * @returns {boolean} True if string appears to be base64
 */
function isBase64(str) {
    if (typeof str !== "string") {
        return false;
    }

    // Empty string is valid base64
    if (str === "") {
        return true;
    }

    // Base64 regex that allows for missing padding
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(str);
}

/**
 * Check if a string is base64 encoded (used for headers)
 * @param {string} str - String to check
 * @returns {boolean} True if string appears to be base64
 */
function isBase64Encoded(str) {
    if (typeof str !== "string") {
        return false;
    }

    // Empty string is not considered encoded
    if (str === "") {
        return false;
    }

    // Base64 regex that allows for missing padding
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(str);
}

/**
 * Check if certificate is expired
 * @param {Object} cert - Parsed certificate object
 * @returns {boolean} True if certificate is expired
 */
function isExpiredCertificate(cert) {
    if (!cert || !cert.validFrom || !cert.validTo) {
        return true;
    }

    const now = new Date();
    return now < cert.validFrom || now > cert.validTo;
}

/**
 * Get certificate validity window information
 * @param {Object} cert - Parsed certificate object
 * @returns {Object} Validity information
 */
function getCertificateValidityWindow(cert) {
    if (!cert || !cert.validFrom || !cert.validTo) {
        return {
            isValid: false,
            validFrom: null,
            validTo: null,
        };
    }

    const now = new Date();
    const isValid = now >= cert.validFrom && now <= cert.validTo;

    const result = {
        isValid,
        validFrom: cert.validFrom,
        validTo: cert.validTo,
    };

    if (isValid) {
        const msRemaining = cert.validTo.getTime() - now.getTime();
        result.daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
    }

    return result;
}

module.exports = {
    tokenizeDn,
    dnTokensMatch,
    parseDnString,
    extractCertificateFromHeader,
    parseCertificateFromPem,
    formatPemCertificate,
    isBase64,
    isBase64Encoded,
    isExpiredCertificate,
    getCertificateValidityWindow,
};
