const { Logger } = require("./logger");

/**
 * MCP Plugin Adapter
 * Provides an abstraction layer for interacting with @btp-ai/mcp-plugin
 * This allows for easy mocking and testing without requiring the actual plugin
 */

/**
 * Check if MCP plugin is available
 * @param {Function} resolveFunction - Optional custom resolve function for testing
 * @returns {boolean} True if plugin is available
 */
function isMCPPluginAvailable(resolveFunction = require.resolve) {
    try {
        resolveFunction("@btp-ai/mcp-plugin");
        Logger.log("MCP plugin is available");
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
 * Build MCP server definition from CDS services
 * @param {Array} services - Array of CDS services
 * @returns {Promise<Object>} MCP server definition
 * @throws {Error} If MCP plugin is not available
 */
async function buildMcpServerDefinition(services) {
    const plugin = getMcpPlugin();
    
    if (!plugin) {
        throw new Error("MCP plugin not available");
    }
    
    try {
        const { buildMcpServerDefinitionByService } = require("@btp-ai/mcp-plugin/lib/utils/metadata");
        return await buildMcpServerDefinitionByService(services);
    } catch (error) {
        Logger.error("Failed to build MCP server definition:", error.message);
        throw error;
    }
}

module.exports = {
    isMCPPluginAvailable,
    getMcpPlugin,
    buildMcpServerDefinition,
};
