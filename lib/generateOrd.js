const cds = require("@sap/cds");
const path = require("path");
const fs = require("fs");
const { Logger } = require("./logger");

/**
 * Load App Foundation configuration file from configurable path
 * @returns {object|null} Parsed App Foundation configuration or null if not found
 */
function _loadAppFoundationConfig() {
    // Get configurable path from .cdsrc.json, default to service.yaml
    const configFile = cds.env.ord?.appFoundationConfigFile || "service.yaml";
    const configPath = path.join(cds.root, configFile);

    if (!cds.utils.exists(configPath)) {
        Logger.log(`No ${configFile} found, skipping Integration Dependency generation`);
        return null;
    }

    try {
        Logger.log(`Loading App Foundation config from ${configPath}`);
        const yaml = require("js-yaml");
        const configContent = fs.readFileSync(configPath, "utf8");
        const appFoundationConfig = yaml.load(configContent);
        Logger.log("Successfully loaded App Foundation configuration");
        return appFoundationConfig;
    } catch (error) {
        Logger.error(`Error loading App Foundation config: ${error.message}`);
        return null;
    }
}

/**
 * Handle Integration Dependency generation and add to ORD document
 * @param {object} ordDocument - The ORD document to enhance
 * @param {object} appFoundationConfig - Parsed App Foundation configuration
 * @returns {boolean} True if Integration Dependencies were added
 */
function _handleIntegrationDependency(ordDocument, appFoundationConfig) {
    // Check both possible paths for data products consumption config
    // Support both legacy (overrides) and new (spec) structure formats
    const consumption = appFoundationConfig?.overrides?.dataProducts?.consumption || 
                       appFoundationConfig?.spec?.dataProducts?.consumption;
    
    // If no consumption config, return false
    if (!consumption) {
        Logger.log("No data products consumption configuration found, skipping Integration Dependencies");
        return false;
    }

    Logger.log("Processing Integration Dependencies from App Foundation config");

    // Generate Integration Dependencies
    const { generateIntegrationDependencies } = require("./integrationDependency");

    try {
        // Extract package IDs from existing packages
        const packageIds = ordDocument.packages?.map((pkg) => pkg.ordId) || [];

        // Create minimal appConfig needed for generation
        const appConfig = {
            ordNamespace: packageIds[0]?.split(":")[0] || "customer.unknown",
        };

        const integrationDependencies = generateIntegrationDependencies(appFoundationConfig, appConfig, packageIds);

        if (integrationDependencies.length) {
            // Mutate in place - add Integration Dependencies directly to the document
            ordDocument.integrationDependencies = integrationDependencies;
            Logger.log(
                `Added ${integrationDependencies.length} Integration Dependenc${integrationDependencies.length === 1 ? "y" : "ies"} to ORD document`,
            );
            return true;
        }
    } catch (error) {
        Logger.error(`Failed to generate Integration Dependencies: ${error.message}`);
    }

    return false;
}

/**
 * Generate complete ORD document from CSN with all enrichments
 * This is the central function used by both compile and build paths
 *
 * @param {object} csn - CDS CSN model
 * @param {object} options - Generation options
 * @param {string} options.mode - Generation mode: 'compile' or 'build'
 * @param {boolean} options.includeIntegrationDependencies - Force include Integration Dependencies even in compile mode
 * @returns {object} Complete ORD document with all enrichments
 */
function generateOrd(csn, options = {}) {
    const mode = options.mode || "compile";
    Logger.log(`Generating ORD document in ${mode} mode`);

    // Step 1: Generate base ORD document using existing ord.js logic
    const ord = require("./ord");
    const ordDocument = ord(csn);

    // Step 2: Add Integration Dependencies if applicable
    // Always check for App Foundation config unless explicitly disabled
    // This ensures both compile (Java) and build (Node.js) paths get Integration Dependencies
    const shouldProcessIntegrationDependencies = options.includeIntegrationDependencies !== false;

    if (shouldProcessIntegrationDependencies) {
        const appFoundationConfig = _loadAppFoundationConfig();

        if (appFoundationConfig) {
            const hasIntegrationDependencies = _handleIntegrationDependency(ordDocument, appFoundationConfig);

            if (hasIntegrationDependencies) {
                Logger.log("Integration Dependencies successfully added to ORD document");
            }
        }
    }

    // Step 3: Future enhancements can be added here
    // - UCL support
    // - Additional enrichments
    // - Other cross-cutting features

    Logger.log(`ORD document generation complete (${mode} mode)`);
    return ordDocument;
}

module.exports = {
    generateOrd,
    // Export internal functions for testing
    _loadAppFoundationConfig,
    _handleIntegrationDependency,
};
