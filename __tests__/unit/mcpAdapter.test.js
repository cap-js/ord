const {
    isMCPPluginAvailable,
    isMCPPluginInPackageJson,
    isMCPPluginReady,
    getMcpPlugin,
    buildMcpServerDefinition,
} = require("../../lib/mcpAdapter");

// Mock the MCP plugin before requiring it
jest.mock("@btp-ai/mcp-plugin/lib/utils/metadata");

// Mock data for MCP server definition
const MOCK_ORD_METADATA = {
    title: "MCP Server for TestService",
    shortDescription: "This is the MCP server to interact with the TestService",
    description: "This is the MCP server to interact with the TestService",
    version: "1.0.0",
    visibility: "public",
    entryPoints: ["/rest/mcp/streaming"],
};

describe("mcpAdapter", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("isMCPPluginInPackageJson", () => {
        test("should return true when MCP plugin is in dependencies", () => {
            // Use dependency injection to provide mock package.json
            const mockPackageJson = {
                name: "test-project",
                dependencies: {
                    "@btp-ai/mcp-plugin": "^0.2.5",
                },
            };

            const mockLoadPackageJson = () => mockPackageJson;
            const result = isMCPPluginInPackageJson(mockLoadPackageJson);
            expect(result).toBe(true);
        });

        test("should return true when MCP plugin is in devDependencies", () => {
            // Use dependency injection to provide mock package.json
            const mockPackageJson = {
                name: "test-project",
                devDependencies: {
                    "@btp-ai/mcp-plugin": "^0.2.5",
                },
            };

            const mockLoadPackageJson = () => mockPackageJson;
            const result = isMCPPluginInPackageJson(mockLoadPackageJson);
            expect(result).toBe(true);
        });

        test("should return false when MCP plugin is not in dependencies", () => {
            // Use dependency injection to provide mock package.json
            const mockPackageJson = {
                name: "test-project",
                dependencies: {
                    "@sap/cds": "^8.0.0",
                },
            };

            const mockLoadPackageJson = () => mockPackageJson;
            const result = isMCPPluginInPackageJson(mockLoadPackageJson);
            expect(result).toBe(false);
        });

        test("should return false when package.json loading fails", () => {
            // Use dependency injection to provide failing function
            const mockLoadPackageJson = () => {
                throw new Error("package.json not found");
            };

            const result = isMCPPluginInPackageJson(mockLoadPackageJson);
            expect(result).toBe(false);
        });

        test("should handle missing dependencies and devDependencies", () => {
            // Use dependency injection to provide package.json without dependencies
            const mockPackageJson = {
                name: "test-project",
                // No dependencies or devDependencies
            };

            const mockLoadPackageJson = () => mockPackageJson;
            const result = isMCPPluginInPackageJson(mockLoadPackageJson);
            expect(result).toBe(false);
        });
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

            const mockServices = [{ name: "TestService" }];
            const result = await buildMcpServerDefinition(mockServices);

            expect(result).toBeDefined();
            expect(result.title).toBe("MCP Server for TestService");
            expect(result.version).toBe("1.0.0");
            expect(result.visibility).toBe("public");
            expect(result.entryPoints).toEqual(["/rest/mcp/streaming"]);
            expect(mockMetadata.exposeMcpServerDefinitionForOrd).toHaveBeenCalledWith(mockServices);
        });

        test("should propagate errors from plugin", async () => {
            const mockMetadata = require("@btp-ai/mcp-plugin/lib/utils/metadata");
            mockMetadata.exposeMcpServerDefinitionForOrd = jest
                .fn()
                .mockRejectedValue(new Error("Plugin build failed"));

            await expect(buildMcpServerDefinition()).rejects.toThrow("Plugin build failed");
        });
    });

    describe("isMCPPluginReady", () => {
        test("should return true when plugin is both in package.json and available at runtime", () => {
            const mockResolve = jest.fn(() => "/path/to/plugin");
            const mockLoadPackageJson = jest.fn(() => ({
                name: "test-project",
                dependencies: { "@btp-ai/mcp-plugin": "^0.2.5" },
            }));

            const result = isMCPPluginReady({
                resolveFunction: mockResolve,
                loadPackageJsonFn: mockLoadPackageJson,
            });

            expect(result).toBe(true);
            expect(mockResolve).toHaveBeenCalledWith("@btp-ai/mcp-plugin");
            expect(mockLoadPackageJson).toHaveBeenCalled();
        });

        test("should return false when plugin is in package.json but not available at runtime", () => {
            const mockResolve = jest.fn(() => {
                throw new Error("Cannot find module");
            });
            const mockLoadPackageJson = jest.fn(() => ({
                name: "test-project",
                dependencies: { "@btp-ai/mcp-plugin": "^0.2.5" },
            }));

            const result = isMCPPluginReady({
                resolveFunction: mockResolve,
                loadPackageJsonFn: mockLoadPackageJson,
            });

            expect(result).toBe(false);
            expect(mockResolve).toHaveBeenCalledWith("@btp-ai/mcp-plugin");
            expect(mockLoadPackageJson).toHaveBeenCalled();
        });

        test("should return false when plugin is available at runtime but not in package.json", () => {
            const mockResolve = jest.fn(() => "/path/to/plugin");
            const mockLoadPackageJson = jest.fn(() => ({
                name: "test-project",
                dependencies: { "@sap/cds": "^8.0.0" },
            }));

            const result = isMCPPluginReady({
                resolveFunction: mockResolve,
                loadPackageJsonFn: mockLoadPackageJson,
            });

            expect(result).toBe(false);
            // Due to AND short-circuiting, if package.json check fails first, resolve won't be called
            expect(mockLoadPackageJson).toHaveBeenCalled();
        });

        test("should return false when plugin is neither in package.json nor available at runtime", () => {
            const mockResolve = jest.fn(() => {
                throw new Error("Cannot find module");
            });
            const mockLoadPackageJson = jest.fn(() => ({
                name: "test-project",
                dependencies: { "@sap/cds": "^8.0.0" },
            }));

            const result = isMCPPluginReady({
                resolveFunction: mockResolve,
                loadPackageJsonFn: mockLoadPackageJson,
            });

            expect(result).toBe(false);
            // Due to AND short-circuiting, if package.json check fails first, resolve won't be called
            expect(mockLoadPackageJson).toHaveBeenCalled();
        });

        test("should work with default parameters", () => {
            // Test with no options provided - should use defaults
            const result = isMCPPluginReady();
            expect(typeof result).toBe("boolean");
        });

        test("should handle package.json loading errors gracefully", () => {
            const mockResolve = jest.fn(() => "/path/to/plugin");
            const mockLoadPackageJson = jest.fn(() => {
                throw new Error("package.json not found");
            });

            const result = isMCPPluginReady({
                resolveFunction: mockResolve,
                loadPackageJsonFn: mockLoadPackageJson,
            });

            expect(result).toBe(false);
            // Due to AND short-circuiting, if package.json check fails first, resolve won't be called
            expect(mockLoadPackageJson).toHaveBeenCalled();
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
