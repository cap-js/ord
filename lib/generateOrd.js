const cds = require("@sap/cds");
const path = require("path");
const fs = require("fs");
const { Logger } = require("./logger");

/**
 * Load app.yaml configuration from project root
 * @returns {object|null} Parsed app.yaml configuration or null if not found
 */
function _loadAppYaml() {
    const appYamlPath = path.join(cds.root, "app.yaml");

    if (!cds.utils.exists(appYamlPath)) {
        Logger.log("No app.yaml found in project root, skipping Integration Dependency generation");
        return null;
    }

    try {
        Logger.log(`Loading app.yaml from ${appYamlPath}`);
        const yaml = require("js-yaml");
        const appYamlContent = fs.readFileSync(appYamlPath, "utf8");
        const appFoundationConfig = yaml.load(appYamlContent);
        Logger.log("Successfully loaded app.yaml configuration");
        return appFoundationConfig;
    } catch (error) {
        Logger.error(`Error loading app.yaml: ${error.message}`);
        return null;
    }
}

/**
 * Handle Integration Dependency generation and add to ORD document
 * @param {object} ordDocument - The ORD document to enhance
 * @param {object} appFoundationConfig - Parsed app.yaml configuration
 * @returns {boolean} True if Integration Dependencies were added
 */
function _handleIntegrationDependency(ordDocument, appFoundationConfig) {
    // If no consumption config, return false
    if (!appFoundationConfig?.overrides?.dataProducts?.consumption) {
        return false;
    }

    Logger.log("Processing Integration Dependencies from app.yaml");

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
    // Always check for app.yaml unless explicitly disabled
    // This ensures both compile (Java) and build (Node.js) paths get Integration Dependencies
    const shouldProcessIntegrationDependencies = options.includeIntegrationDependencies !== false;

    if (shouldProcessIntegrationDependencies) {
        const appFoundationConfig = _loadAppYaml();

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
    _loadAppYaml,
    _handleIntegrationDependency,
};
