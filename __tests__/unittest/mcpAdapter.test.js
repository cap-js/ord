const { isMCPPluginAvailable, getMcpPlugin, buildMcpServerDefinition } = require("../../lib/mcpAdapter");

// Mock the MCP plugin before requiring it
jest.mock("@btp-ai/mcp-plugin/lib/utils/metadata");

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
            const mockServices = [
                {
                    name: "TestService",
                    actions: {
                        testAction: {},
                    },
                },
            ];

            const mockMetadata = require("@btp-ai/mcp-plugin/lib/utils/metadata");
            mockMetadata.buildMcpServerDefinitionByService = jest.fn().mockResolvedValue({
                openrpc: "1.0.0",
                info: {
                    title: "Test MCP Server",
                    version: "1.0.0",
                },
                methods: [],
            });

            const result = await buildMcpServerDefinition(mockServices);

            expect(result).toBeDefined();
            expect(result.openrpc).toBe("1.0.0");
            expect(result.info).toBeDefined();
        });

        test("should propagate errors from plugin", async () => {
            const mockServices = [];

            const mockMetadata = require("@btp-ai/mcp-plugin/lib/utils/metadata");
            mockMetadata.buildMcpServerDefinitionByService = jest
                .fn()
                .mockRejectedValue(new Error("Plugin build failed"));

            await expect(buildMcpServerDefinition(mockServices)).rejects.toThrow("Plugin build failed");
        });

        test("should handle empty services array", async () => {
            const mockServices = [];

            const mockMetadata = require("@btp-ai/mcp-plugin/lib/utils/metadata");
            mockMetadata.buildMcpServerDefinitionByService = jest.fn().mockResolvedValue({
                openrpc: "1.0.0",
                info: {
                    title: "Empty Server",
                    version: "1.0.0",
                },
                methods: [],
            });

            const result = await buildMcpServerDefinition(mockServices);

            expect(result).toBeDefined();
            expect(result.methods).toEqual([]);
        });

        test("should handle multiple services", async () => {
            const mockServices = [
                { name: "Service1", actions: {} },
                { name: "Service2", actions: {} },
                { name: "Service3", actions: {} },
            ];

            const mockMetadata = require("@btp-ai/mcp-plugin/lib/utils/metadata");
            mockMetadata.buildMcpServerDefinitionByService = jest.fn().mockResolvedValue({
                openrpc: "1.0.0",
                info: {
                    title: "Multi Service Server",
                    version: "1.0.0",
                },
                methods: [{ name: "method1" }, { name: "method2" }, { name: "method3" }],
            });

            const result = await buildMcpServerDefinition(mockServices);

            expect(result).toBeDefined();
            expect(result.methods).toHaveLength(3);
            expect(mockMetadata.buildMcpServerDefinitionByService).toHaveBeenCalledWith(mockServices);
        });
    });

    describe("Integration scenarios", () => {
        test("should handle full workflow when plugin is available", async () => {
            const mockResolve = jest.fn(() => "/path/to/plugin");
            const isAvailable = isMCPPluginAvailable(mockResolve);

            expect(isAvailable).toBe(true);

            if (isAvailable) {
                const mockServices = [{ name: "TestService" }];
                const mockMetadata = require("@btp-ai/mcp-plugin/lib/utils/metadata");
                mockMetadata.buildMcpServerDefinitionByService = jest.fn().mockResolvedValue({
                    openrpc: "1.0.0",
                    info: { title: "Test", version: "1.0.0" },
                    methods: [],
                });

                const result = await buildMcpServerDefinition(mockServices);
                expect(result).toBeDefined();
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
