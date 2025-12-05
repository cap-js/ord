/**
 * Mock for @btp-ai/mcp-plugin/lib/utils/metadata
 * This handles the deep import used in the production code
 * The mock content is minimal since the actual data is not used in tests
 */

const mockMcpServerDefinition = {};

const exposeMcpServerDefinitionForOrd = jest.fn().mockResolvedValue(mockMcpServerDefinition);

module.exports = {
    exposeMcpServerDefinitionForOrd,
};
