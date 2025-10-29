const crypto = require("crypto");
const fs = require("fs").promises;
const { Logger } = require("../logger");

/**
 * Certificate Loader class for managing CA certificates
 */
class CertificateLoader {
    constructor(caChainFilePath) {
        this.certificates = new Map();
        this.certificatesBySubject = new Map();
        this.initialized = false;
        this.caChainFilePath = caChainFilePath;
        this.caDefinitions = [];
    }

    /**
     * Initialize the certificate loader
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            // Load CA definitions from configuration
            await this._loadCaDefinitions();

            Logger.log(`Initializing certificate loader with ${this.caDefinitions.length} CA definitions...`);

            const results = await Promise.allSettled(
                this.caDefinitions.map((ca) => this._loadCertificate(ca)),
            );

            const loaded = results.filter((r) => r.status === "fulfilled").length;
            const failed = results.filter((r) => r.status === "rejected").length;

            Logger.log(`Loaded ${loaded} CA certificates, ${failed} failed`);

            if (loaded === 0 && this.caDefinitions.length > 0) {
                throw new Error("Failed to load any CA certificates");
            }

            this.initialized = true;
        } catch (error) {
            Logger.error("CertificateLoader initialization failed:", error.message);
            throw error;
        }
    }

    /**
     * Load CA definitions from file or inline JSON
     * @private
     * @returns {Promise<void>}
     */
    async _loadCaDefinitions() {
        if (!this.caChainFilePath) {
            Logger.log("No CA chain configuration provided - mTLS will use basic validation only");
            return;
        }

        try {
            let jsonContent;
            const trimmedInput = this.caChainFilePath.trim();

            // Check if input is inline JSON (starts with [ or {)
            if (trimmedInput.startsWith("[") || trimmedInput.startsWith("{")) {
                Logger.log("Loading CA chain definitions from inline JSON");
                jsonContent = trimmedInput;
            } else {
                // Treat as file path
                Logger.log(`Loading CA chain definitions from file: ${this.caChainFilePath}`);
                jsonContent = await fs.readFile(this.caChainFilePath, "utf-8");
            }

            const parsed = JSON.parse(jsonContent);

            if (!Array.isArray(parsed)) {
                throw new Error("CA chain configuration must be a JSON array");
            }

            // Validate each entry
            for (const entry of parsed) {
                if (!entry.name || typeof entry.name !== "string") {
                    throw new Error("Invalid CA definition: missing or invalid 'name' field");
                }
                if (!entry.url || typeof entry.url !== "string") {
                    throw new Error(`Invalid CA definition for '${entry.name}': missing or invalid 'url' field`);
                }
            }

            this.caDefinitions = parsed;
            Logger.log(`Successfully loaded ${this.caDefinitions.length} CA definitions`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            Logger.error(`Failed to load CA chain configuration: ${message}`);
            throw new Error(`Failed to load CA chain configuration: ${message}`);
        }
    }

    /**
     * Load a single certificate from URL
     * @private
     * @param {Object} ca - CA definition object
     * @returns {Promise<void>}
     */
    async _loadCertificate(ca) {
        try {
            const certData = await this._fetchWithRetry(ca.url);
            const certificate = this._parseCertificate(certData);

            this.certificates.set(ca.name, certificate);
            this.certificatesBySubject.set(certificate.subject, certificate);

            Logger.log(`Loaded certificate: ${ca.name} (${certificate.subject})`);
        } catch (error) {
            Logger.error(`Failed to load certificate ${ca.name}: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Fetch certificate with retry logic
     * @private
     * @param {string} url - URL to fetch from
     * @param {number} retries - Number of retries
     * @returns {Promise<string>} PEM certificate
     */
    async _fetchWithRetry(url, retries = 3) {
        let lastError = null;

        for (let i = 0; i < retries; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(url, {
                    headers: { Accept: "application/x-x509-ca-cert,application/pkix-cert" },
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const buffer = await response.arrayBuffer();
                return this._convertToPEM(buffer);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (i < retries - 1) {
                    const delay = Math.pow(2, i) * 1000;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error("Failed to fetch certificate");
    }

    /**
     * Convert buffer to PEM format
     * @private
     * @param {ArrayBuffer} buffer - Certificate buffer
     * @returns {string} PEM formatted certificate
     */
    _convertToPEM(buffer) {
        const base64 = Buffer.from(buffer).toString("base64");
        const lines = base64.match(/.{1,64}/g) || [];
        return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`;
    }

    /**
     * Parse certificate from PEM data
     * @private
     * @param {string} pemData - PEM certificate data
     * @returns {crypto.X509Certificate} Parsed certificate
     */
    _parseCertificate(pemData) {
        try {
            return new crypto.X509Certificate(pemData);
        } catch {
            // Try DER format if PEM fails
            const derBuffer = Buffer.from(
                pemData.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""),
                "base64",
            );
            return new crypto.X509Certificate(derBuffer);
        }
    }

    /**
     * Get certificate by subject DN
     * @param {string} subject - Certificate subject DN
     * @returns {crypto.X509Certificate|undefined} Certificate or undefined
     */
    getCertificateBySubject(subject) {
        return this.certificatesBySubject.get(subject);
    }

    /**
     * Get certificate by name
     * @param {string} name - Certificate name
     * @returns {crypto.X509Certificate|undefined} Certificate or undefined
     */
    getCertificateByName(name) {
        return this.certificates.get(name);
    }

    /**
     * Get all loaded certificates
     * @returns {crypto.X509Certificate[]} Array of certificates
     */
    getAllCertificates() {
        return Array.from(this.certificates.values());
    }

    /**
     * Get CA certificate definitions
     * @returns {Object[]} Array of CA definitions
     */
    getCACertificateDefinitions() {
        return this.caDefinitions;
    }

    /**
     * Check if loader is initialized
     * @returns {boolean} True if initialized
     */
    isInitialized() {
        return this.initialized;
    }
}

// Global loader instance
let globalLoader = null;

/**
 * Get or create certificate loader instance
 * @param {string} [caChainFilePath] - Path to CA chain file or inline JSON
 * @returns {Promise<CertificateLoader>} Certificate loader instance
 */
async function getCertificateLoader(caChainFilePath) {
    if (!globalLoader || (caChainFilePath && globalLoader.caChainFilePath !== caChainFilePath)) {
        globalLoader = new CertificateLoader(caChainFilePath);
        await globalLoader.initialize();
    }
    return globalLoader;
}

/**
 * Reset global loader (for testing)
 */
function resetCertificateLoader() {
    globalLoader = null;
}

module.exports = {
    CertificateLoader,
    getCertificateLoader,
    resetCertificateLoader,
};
