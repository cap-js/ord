const { Logger } = require("./logger");

/**
 * Convert Java-style namespace to ORD-compliant namespace
 * e.g., "com.sap.intelligent.supplychain" -> "sap.intelligentsupplychain"
 *
 * @param {string} javaNamespace - Java package style namespace
 * @returns {string} ORD-compliant namespace
 */
function convertToOrdNamespace(javaNamespace) {
    if (!javaNamespace) {
        throw new Error("Namespace is required for Integration Dependency generation");
    }

    const parts = javaNamespace.split(".");

    // Extract vendor (usually after 'com' or directly if short)
    // e.g., "com.sap.intelligent.supplychain" -> ["com", "sap", "intelligent", "supplychain"]
    let vendor, systemParts;

    if (parts[0] === "com" || parts[0] === "org") {
        vendor = parts[1]; // "sap"
        systemParts = parts.slice(2); // ["intelligent", "supplychain"]
    } else {
        vendor = parts[0];
        systemParts = parts.slice(1);
    }

    // Join system parts without dots
    const systemId = systemParts.join("").toLowerCase();

    return `${vendor}.${systemId}`;
}

/**
 * Generate resource name from consumed data product ORD ID
 * e.g., "sap.s4com:apiResource:PurchaseOrder:v1" -> "S4comPurchaseOrder"
 *
 * @param {string} consumedOrdId - ORD ID of the consumed resource
 * @returns {string} Resource name for Integration Dependency
 */
function generateResourceName(consumedOrdId) {
    if (!consumedOrdId) {
        throw new Error("Consumed ORD ID is required for resource name generation");
    }

    try {
        const parts = consumedOrdId.split(":");
        if (parts.length < 3) {
            throw new Error(`Invalid ORD ID format: ${consumedOrdId}`);
        }

        const sourceNamespace = parts[0]; // "sap.s4com"
        const resourceName = parts[2]; // "PurchaseOrder"

        // Extract source system from namespace
        // "sap.s4com" -> ["sap", "s4com"]
        const nsParts = sourceNamespace.split(".");
        const sourceSystem = nsParts.slice(1).join(""); // "s4com"

        // Capitalize first letter
        const capitalizedSystem = sourceSystem.charAt(0).toUpperCase() + sourceSystem.slice(1);

        // Combine: "S4com" + "PurchaseOrder"
        return `${capitalizedSystem}${resourceName}`;
    } catch (error) {
        Logger.error(`Error generating resource name from ${consumedOrdId}:`, error.message);
        throw error;
    }
}

/**
 * Extract major version from semantic version
 * e.g., "1.2.3" -> "1"
 *
 * @param {string} version - Semantic version string
 * @returns {string} Major version number
 */
function extractMajorVersion(version) {
    if (!version) {
        throw new Error("Version is required for ORD ID generation");
    }

    const match = version.match(/^(\d+)/);
    if (!match) {
        throw new Error(`Invalid version format: ${version}`);
    }

    return match[1];
}

/**
 * Generate complete Integration Dependency ORD ID
 *
 * @param {string} ordNamespace - ORD namespace for the application
 * @param {string} consumedOrdId - ORD ID of consumed resource
 * @param {string} version - Minimum version from config
 * @returns {string} Complete Integration Dependency ORD ID
 */
function generateIntegrationDependencyOrdId(ordNamespace, consumedOrdId, version) {
    const resourceName = generateResourceName(consumedOrdId);
    const majorVersion = extractMajorVersion(version);

    return `${ordNamespace}:integrationDependency:${resourceName}:v${majorVersion}`;
}

/**
 * Generate title from consumed ORD ID
 * e.g., "sap.s4com:apiResource:PurchaseOrder:v1" -> "S/4HANA Commerce Purchase Order Integration"
 *
 * @param {string} consumedOrdId - ORD ID of consumed resource
 * @returns {string} Human-readable title
 */
function generateTitle(consumedOrdId) {
    const parts = consumedOrdId.split(":");
    const sourceNamespace = parts[0];
    const resourceName = parts[2];

    // Map common namespaces to display names
    const namespaceDisplayNames = {
        "sap.s4": "S/4HANA",
        "sap.s4com": "S/4HANA Commerce",
        "sap.ariba": "SAP Ariba",
        "sap.successfactors": "SAP SuccessFactors",
        "sap.concur": "SAP Concur",
        "sap.fieldglass": "SAP Fieldglass",
    };

    const displayName = namespaceDisplayNames[sourceNamespace] || sourceNamespace.toUpperCase();

    // Add spaces before capital letters in resource name
    const formattedResourceName = resourceName.replace(/([A-Z])/g, " $1").trim();

    return `${displayName} ${formattedResourceName} Integration`;
}

/**
 * Generate simple description without markdown formatting
 *
 * @param {string} consumedOrdId - ORD ID of consumed resource
 * @param {object} config - Data product configuration
 * @returns {string} Plain text description
 */
function generateDescription(consumedOrdId, config) {
    const parts = consumedOrdId.split(":");
    const sourceNamespace = parts[0];
    const resourceType = parts[1];
    const resourceName = parts[2];

    const formattedResourceName = resourceName.replace(/([A-Z])/g, " $1").trim();
    const consumptionType = config.consumptionType || "replication";
    const capModel = config.capConsumption?.model || "N/A";
    const minimumVersion = config.minimumVersion || "N/A";

    const dependencyStatus = config.mandatory
        ? "This is a mandatory dependency required for core functionality."
        : "This is an optional dependency that enhances functionality.";

    return `Integration with ${sourceNamespace} for accessing ${formattedResourceName} data. Integration pattern: ${consumptionType}. Consumed resource: ${consumedOrdId} (resource type: ${resourceType}, minimum version: ${minimumVersion}). CAP model: ${capModel}. ${dependencyStatus} Enables data access and integration with ${sourceNamespace} for enhanced analytics and business process support.`;
}

/**
 * Generate a single Integration Dependency from data product consumption config
 *
 * @param {object} appFoundationConfig - Complete app.yaml configuration
 * @param {object} appConfig - Application configuration from ord.js
 * @param {string} consumedOrdId - ORD ID of the consumed data product
 * @param {object} dataProductConfig - Configuration for this specific data product
 * @param {string[]} packageIds - Available package IDs
 * @returns {object} Integration Dependency ORD structure
 */
function generateIntegrationDependency(appFoundationConfig, appConfig, consumedOrdId, dataProductConfig, packageIds) {
    try {
        // Get application namespace - try multiple possible sources
        let appNamespace = appFoundationConfig.overrides?.commercial?.["application-namespace"];

        // If not found in overrides, try to derive from appConfig.ordNamespace
        if (!appNamespace && appConfig.ordNamespace) {
            // Convert back to Java-style namespace for consistency
            // e.g., "customer.unknown" -> "com.customer.unknown"
            const parts = appConfig.ordNamespace.split(".");
            if (parts.length >= 2) {
                appNamespace = `com.${parts.join(".")}`;
            } else {
                appNamespace = `com.${appConfig.ordNamespace}`;
            }
        }

        // Fallback to a default namespace
        if (!appNamespace) {
            appNamespace = "com.customer.application";
        }

        // Convert to ORD namespace
        const ordNamespace = convertToOrdNamespace(appNamespace);

        // Generate ORD ID
        const minimumVersion = dataProductConfig.minimumVersion || "1.0.0";
        const ordId = generateIntegrationDependencyOrdId(ordNamespace, consumedOrdId, minimumVersion);

        // Generate local ID (without namespace and version)
        const localId = generateResourceName(consumedOrdId);

        // Select package (use first available package or create a default reference)
        const partOfPackage =
            packageIds && packageIds.length > 0 ? packageIds[0] : `${ordNamespace}:package:CoreIntegrations:v1`;

        // Build the Integration Dependency object (only mandatory fields)
        const integrationDependency = {
            ordId,
            title: generateTitle(consumedOrdId),
            description: generateDescription(consumedOrdId, dataProductConfig),
            partOfPackage,
            version: minimumVersion,
            releaseStatus: "active",
            visibility: "public",
            mandatory: dataProductConfig.mandatory !== undefined ? dataProductConfig.mandatory : false,
            aspects: [
                {
                    title: `${consumedOrdId.split(":")[2]} Data Access`,
                    description: `${(dataProductConfig.consumptionType || "replication").charAt(0).toUpperCase() + (dataProductConfig.consumptionType || "replication").slice(1)} of ${consumedOrdId.split(":")[2].toLowerCase()} data`,
                    mandatory: dataProductConfig.mandatory !== undefined ? dataProductConfig.mandatory : false,
                    supportMultipleProviders: false,
                    apiResources: [
                        {
                            ordId: consumedOrdId,
                            minVersion: minimumVersion,
                        },
                    ],
                },
            ],
        };

        Logger.log(`Generated Integration Dependency: ${ordId}`);

        return integrationDependency;
    } catch (error) {
        Logger.error(`Error generating Integration Dependency for ${consumedOrdId}:`, error.message);
        throw error;
    }
}

/**
 * Generate all Integration Dependencies from app.yaml configuration
 *
 * @param {object} appFoundationConfig - Complete app.yaml configuration
 * @param {object} appConfig - Application configuration from ord.js
 * @param {string[]} packageIds - Available package IDs
 * @returns {object[]} Array of Integration Dependency ORD structures
 */
function generateIntegrationDependencies(appFoundationConfig, appConfig, packageIds) {
    // Check both possible paths for data products consumption config
    // Support both legacy (overrides) and new (spec) structure formats
    const dataProducts =
        appFoundationConfig?.overrides?.dataProducts?.consumption ||
        appFoundationConfig?.spec?.dataProducts?.consumption;

    if (!dataProducts) {
        Logger.log("No data products consumption configuration found in app foundation config");
        return [];
    }
    const integrationDependencies = [];

    Logger.log(`Processing ${Object.keys(dataProducts).length} consumed data product(s) for Integration Dependencies`);

    for (const [consumedOrdId, config] of Object.entries(dataProducts)) {
        try {
            const intDep = generateIntegrationDependency(
                appFoundationConfig,
                appConfig,
                consumedOrdId,
                config,
                packageIds,
            );
            integrationDependencies.push(intDep);
        } catch (error) {
            Logger.error(`Failed to generate Integration Dependency for ${consumedOrdId}:`, error.message);
            // Continue with other dependencies
        }
    }

    Logger.log(
        `Successfully generated ${integrationDependencies.length} Integration Dependenc${integrationDependencies.length === 1 ? "y" : "ies"}`,
    );

    return integrationDependencies;
}

module.exports = {
    generateIntegrationDependencies,
    generateIntegrationDependency,
    // Export helpers for testing
    convertToOrdNamespace,
    generateResourceName,
    generateIntegrationDependencyOrdId,
    extractMajorVersion,
    generateTitle,
    generateDescription,
};
