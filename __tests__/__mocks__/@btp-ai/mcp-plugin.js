/**
 * Mock implementation of @btp-ai/mcp-plugin for testing
 * This prevents tests from depending on the actual plugin being installed
 */

const mockMcpServerDefinition = {
    title: "Mock MCP Server",
    shortDescription: "This is a mock MCP server for testing",
    description: "This is a mock MCP server for testing purposes",
    version: "1.0.0",
    visibility: "public",
    entryPoints: ["/rest/mcp/streaming"],
};

const exposeMcpServerDefinitionForOrd = jest.fn().mockResolvedValue(mockMcpServerDefinition);

// Main module export
const mockPlugin = {
    exposeMcpServerDefinitionForOrd,
};

module.exports = mockPlugin;
