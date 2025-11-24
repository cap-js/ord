/**
 * Mock for @btp-ai/mcp-plugin/lib/utils/metadata
 * This handles the deep import used in the production code
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

module.exports = {
    buildMcpServerDefinitionByService,
};
