const Logger = require("./logger");
const cds = require("@sap/cds");
const path = require("path");

/**
 * MCP Plugin Adapter
 * Provides an abstraction layer for interacting with @btp-ai/mcp-plugin
 * This allows for easy mocking and testing without requiring the actual plugin
 */

/**
 * Load package.json from project root
 * @returns {Object} Package.json content
 * @throws {Error} If package.json is not found
 */
function _loadPackageJson() {
    const packageJsonPath = path.join(cds.root, "package.json");
    if (!cds.utils.exists(packageJsonPath)) {
        throw new Error(`package.json not found in the project root directory`);
    }
    return require(packageJsonPath);
}

/**
 * Check if MCP plugin is listed in package.json dependencies
 * @param {Function} loadPackageJsonFn - Optional function to load package.json (for testing)
 * @returns {boolean} True if plugin is in dependencies or devDependencies
 */
function isMCPPluginInPackageJson(loadPackageJsonFn = _loadPackageJson) {
    try {
        const packageJson = loadPackageJsonFn();
        const allDependencies = {
            ...(packageJson.dependencies || {}),
            ...(packageJson.devDependencies || {}),
        };
        const isInstalled = "@btp-ai/mcp-plugin" in allDependencies;
        if (isInstalled) {
            Logger.log("MCP plugin found in package.json dependencies");
        }
        return isInstalled;
    } catch (error) {
        Logger.error("Could not check package.json for MCP plugin:", error.message);
        return false;
    }
}

/**
 * Check if MCP plugin is available at runtime
 * @param {Function} resolveFunction - Optional custom resolve function for testing
 * @returns {boolean} True if plugin is available
 */
function isMCPPluginAvailable(resolveFunction = require.resolve) {
    try {
        resolveFunction("@btp-ai/mcp-plugin");
        Logger.log("MCP plugin is available at runtime");
        return true;
    } catch {
        return false;
    }
}

/**
 * Get MCP plugin instance
 * Returns null if plugin is not available
 * @returns {Object|null} MCP plugin module or null
 */
function getMcpPlugin() {
    if (!isMCPPluginAvailable()) {
        return null;
    }

    try {
        return require("@btp-ai/mcp-plugin");
    } catch (error) {
        Logger.error("Failed to load MCP plugin:", error.message);
        return null;
    }
}

/**
 * Check if MCP plugin is ready for use (both installed and available)
 * This function combines the logic of both isMCPPluginInPackageJson and isMCPPluginAvailable
 * to provide a comprehensive check for MCP plugin readiness.
 * Maintains the original AND logic: both conditions must be true.
 *
 * @param {Object} options - Options for checking
 * @param {Function} options.resolveFunction - Custom resolve function for testing
 * @param {Function} options.loadPackageJsonFn - Custom package.json loader for testing
 * @returns {boolean} True if plugin is ready for use
 */
function isMCPPluginReady(options = {}) {
    const { resolveFunction, loadPackageJsonFn } = options;

    // Both conditions must be satisfied: declared in package.json AND available at runtime
    return isMCPPluginInPackageJson(loadPackageJsonFn) && isMCPPluginAvailable(resolveFunction);
}

/**
 * Build MCP server definition
 * @param {Array} services - Array of CDS services
 * @returns {Promise<Object>} MCP server definition
 * @throws {Error} If MCP plugin is not available
 */
async function buildMcpServerDefinition(services = []) {
    const plugin = getMcpPlugin();

    if (!plugin) {
        throw new Error("MCP plugin not available");
    }

    // Validate services parameter
    if (!Array.isArray(services)) {
        throw new Error("Services parameter must be an array");
    }

    try {
        const { exposeMcpServerDefinitionForOrd } = require("@btp-ai/mcp-plugin/lib/utils/metadata");
        return await exposeMcpServerDefinitionForOrd(services);
    } catch (error) {
        Logger.error("Failed to build MCP server definition:", error.message);
        throw error;
    }
}

module.exports = {
    isMCPPluginAvailable,
    isMCPPluginInPackageJson,
    isMCPPluginReady,
    getMcpPlugin,
    buildMcpServerDefinition,
    _loadPackageJson, // Export for testing
};
