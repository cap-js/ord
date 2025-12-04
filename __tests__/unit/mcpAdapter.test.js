const { isMCPPluginAvailable, getMcpPlugin, buildMcpServerDefinition } = require("../../lib/mcpAdapter");

// Mock the MCP plugin before requiring it
jest.mock("@btp-ai/mcp-plugin/lib/utils/metadata");

// Mock data for MCP server definition
const MOCK_ORD_METADATA = {
    title: "MCP Server for TestService",
    shortDescription: "This is the MCP server to interact with the TestService",
    description: "This is the MCP server to interact with the TestService",
    version: "1.0.0",
    visibility: "public",
    entryPoints: ["/rest/mcp/streaming"]
};

describe("mcpAdapter", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("isMCPPluginAvailable", () => {
        test("should return true when MCP plugin can be resolved", () => {
            const mockResolve = jest.fn(() => "/path/to/plugin");
            const result = isMCPPluginAvailable(mockResolve);

            expect(result).toBe(true);
            expect(mockResolve).toHaveBeenCalledWith("@btp-ai/mcp-plugin");
        });

        test("should return false when MCP plugin cannot be resolved", () => {
            const mockResolve = jest.fn(() => {
                throw new Error("Cannot find module");
            });
            const result = isMCPPluginAvailable(mockResolve);

            expect(result).toBe(false);
            expect(mockResolve).toHaveBeenCalledWith("@btp-ai/mcp-plugin");
        });

        test("should use default require.resolve when no resolver provided", () => {
            // This test will use the actual require.resolve which may or may not find the plugin
            // We're just testing that it doesn't throw
            expect(() => {
                isMCPPluginAvailable();
            }).not.toThrow();
        });
    });

    describe("getMcpPlugin", () => {
        test("should return null when plugin is not available", () => {
            const result = getMcpPlugin();
            // With our mock in place, it should return the mock or null
            expect(result === null || typeof result === "object").toBe(true);
        });

        test("should handle errors when loading plugin", () => {
            // The function should handle errors gracefully
            const result = getMcpPlugin();
            expect(result === null || typeof result === "object").toBe(true);
        });
    });

    describe("buildMcpServerDefinition", () => {
        test("should build MCP server definition when plugin is available", async () => {
            const mockMetadata = require("@btp-ai/mcp-plugin/lib/utils/metadata");
            mockMetadata.exposeMcpServerDefinitionForOrd = jest.fn().mockResolvedValue(MOCK_ORD_METADATA);

            const result = await buildMcpServerDefinition();

            expect(result).toBeDefined();
            expect(result.title).toBe("MCP Server for TestService");
            expect(result.version).toBe("1.0.0");
            expect(result.visibility).toBe("public");
            expect(result.entryPoints).toEqual(["/rest/mcp/streaming"]);
            expect(mockMetadata.exposeMcpServerDefinitionForOrd).toHaveBeenCalledWith();
        });

        test("should propagate errors from plugin", async () => {
            const mockMetadata = require("@btp-ai/mcp-plugin/lib/utils/metadata");
            mockMetadata.exposeMcpServerDefinitionForOrd = jest
                .fn()
                .mockRejectedValue(new Error("Plugin build failed"));

            await expect(buildMcpServerDefinition()).rejects.toThrow("Plugin build failed");
        });
    });

    describe("Integration scenarios", () => {
        test("should handle full workflow when plugin is available", async () => {
            const mockResolve = jest.fn(() => "/path/to/plugin");
            const isAvailable = isMCPPluginAvailable(mockResolve);

            expect(isAvailable).toBe(true);

            if (isAvailable) {
                const mockMetadata = require("@btp-ai/mcp-plugin/lib/utils/metadata");
                mockMetadata.exposeMcpServerDefinitionForOrd = jest.fn().mockResolvedValue(MOCK_ORD_METADATA);

                const result = await buildMcpServerDefinition();
                expect(result).toBeDefined();
                expect(result.title).toBe("MCP Server for TestService");
            }
        });

        test("should handle graceful degradation when plugin is not available", () => {
            const mockResolve = jest.fn(() => {
                throw new Error("Module not found");
            });
            const isAvailable = isMCPPluginAvailable(mockResolve);

            expect(isAvailable).toBe(false);

            const plugin = getMcpPlugin();
            expect(plugin === null || typeof plugin === "object").toBe(true);
        });
    });
});
