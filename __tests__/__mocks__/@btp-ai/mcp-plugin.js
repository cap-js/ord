/**
 * Mock implementation of @btp-ai/mcp-plugin for testing
 * This prevents tests from depending on the actual plugin being installed
 */

const mockMcpServerDefinition = {
    openrpc: "1.0.0",
    info: {
        title: "Mock MCP Server",
        version: "1.0.0",
    },
    methods: [
        {
            name: "test_method",
            description: "Mock test method",
            params: [],
            result: {
                name: "result",
                schema: {
                    type: "object",
                },
            },
        },
    ],
};

const buildMcpServerDefinitionByService = jest.fn().mockResolvedValue(mockMcpServerDefinition);

// Main module export
const mockPlugin = {
    buildMcpServerDefinitionByService,
};

module.exports = mockPlugin;
