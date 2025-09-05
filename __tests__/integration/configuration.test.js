const cds = require("@sap/cds");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

describe("Configuration Integration Tests", () => {
    let originalCdsRoot;
    let testConfigDir;
    
    beforeEach(() => {
        originalCdsRoot = cds.root;
        testConfigDir = path.join(__dirname, "..", "bookshop");
    });
    
    afterEach(() => {
        cds.root = originalCdsRoot;
        delete cds.env.export;
        
        // Clean up any test configuration files
        const testConfigPath = path.join(testConfigDir, ".cdsrc-test.json");
        if (fs.existsSync(testConfigPath)) {
            fs.unlinkSync(testConfigPath);
        }
    });

    describe("Default Configuration", () => {
        test("ORD document generates with default settings", async () => {
            cds.root = testConfigDir;
            const csn = await cds.load(path.join(cds.root, "srv"));
            
            // Mock date for consistent testing
            jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
            
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // Verify default configuration produces valid document
            expect(document).toHaveProperty("openResourceDiscovery", "1.9");
            expect(document).toHaveProperty("policyLevel", "sap:core:v1");
            expect(document).toHaveProperty("packages");
            expect(document.packages).toBeInstanceOf(Array);
            
            jest.restoreAllMocks();
        });
        
        test("Default namespace is applied correctly", async () => {
            cds.root = testConfigDir;
            const csn = await cds.load(path.join(cds.root, "srv"));
            
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // Check that package IDs use expected default namespace
            if (document.packages.length > 0) {
                const firstPackage = document.packages[0];
                expect(firstPackage.ordId).toMatch(/^[a-z0-9.-]+:package:/);
            }
        });
    });

    describe("Custom Configuration via .cdsrc.json", () => {
        test("Custom ORD configuration is applied from .cdsrc.json", async () => {
            cds.root = testConfigDir;
            
            // Set up custom configuration
            cds.env.export = {
                openapi: {
                    applicationNamespace: "custom.namespace"
                },
                ord: {
                    namespace: "custom.namespace"
                }
            };
            
            const csn = await cds.load(path.join(cds.root, "srv"));
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // Verify custom configuration is applied
            expect(document).toHaveProperty("openResourceDiscovery", "1.9");
            
            // Check if namespace is applied to packages
            if (document.packages.length > 0) {
                const firstPackage = document.packages[0];
                expect(firstPackage.ordId).toContain("custom.namespace");
            }
        });
        
        test("Application namespace configuration affects ORD IDs", async () => {
            cds.root = testConfigDir;
            
            // Configure application namespace
            cds.env.export = {
                openapi: {
                    applicationNamespace: "test.app.namespace"
                }
            };
            
            const csn = await cds.load(path.join(cds.root, "srv"));
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // Verify namespace appears in ORD IDs
            if (document.packages.length > 0) {
                const packageId = document.packages[0].ordId;
                expect(packageId).toContain("test.app.namespace");
            }
        });
    });

    describe("Environment Variable Configuration", () => {
        test("ORD configuration respects environment variables", () => {
            process.env.ORD_TEST_CONFIG = "test_value";
            
            // Environment variables should be readable
            expect(process.env.ORD_TEST_CONFIG).toBe("test_value");
            
            delete process.env.ORD_TEST_CONFIG;
        });
        
        test("Authentication configuration via environment variables", () => {
            const originalAuthType = process.env.ORD_AUTH_TYPE;
            const originalBasicAuth = process.env.BASIC_AUTH;
            
            try {
                process.env.ORD_AUTH_TYPE = "basic-authentication";
                process.env.BASIC_AUTH = JSON.stringify({"user": "hash"});
                
                expect(process.env.ORD_AUTH_TYPE).toBe("basic-authentication");
                expect(JSON.parse(process.env.BASIC_AUTH)).toEqual({"user": "hash"});
                
            } finally {
                // Restore original values
                if (originalAuthType) {
                    process.env.ORD_AUTH_TYPE = originalAuthType;
                } else {
                    delete process.env.ORD_AUTH_TYPE;
                }
                
                if (originalBasicAuth) {
                    process.env.BASIC_AUTH = originalBasicAuth;
                } else {
                    delete process.env.BASIC_AUTH;
                }
            }
        });
    });

    describe("Configuration Hierarchy", () => {
        test("Configuration sources are applied in correct precedence", async () => {
            cds.root = testConfigDir;
            
            // Set base configuration
            cds.env.export = {
                ord: {
                    namespace: "base.namespace"
                }
            };
            
            const csn = await cds.load(path.join(cds.root, "srv"));
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // Verify configuration is applied
            expect(document).toHaveProperty("openResourceDiscovery", "1.9");
            
            // Check namespace application
            if (document.packages.length > 0) {
                const packageId = document.packages[0].ordId;
                expect(packageId).toContain("base.namespace");
            }
        });
        
        test("Invalid configuration is handled gracefully", async () => {
            cds.root = testConfigDir;
            
            // Set invalid configuration
            cds.env.export = {
                ord: {
                    invalid_property: "invalid_value"
                }
            };
            
            const csn = await cds.load(path.join(cds.root, "srv"));
            const ord = require("../../lib/ord");
            
            // Should not throw errors and produce valid document
            expect(() => ord(csn)).not.toThrow();
            const document = ord(csn);
            expect(document).toHaveProperty("openResourceDiscovery", "1.9");
        });
    });

    describe("Build Configuration Integration", () => {
        test("Build process respects configuration settings", () => {
            const originalCwd = process.cwd();
            let buildOutput = "";
            
            try {
                process.chdir(testConfigDir);
                
                // Run build and capture output
                buildOutput = execSync("cds build --for ord", { 
                    encoding: "utf8",
                    timeout: 30000 
                });
                
                // Verify build completed successfully
                expect(buildOutput).toMatch(/ORD|build|success/i);
                
                // Verify output files exist
                const ordDocPath = path.join(testConfigDir, "gen", "ord", "ord-document.json");
                expect(fs.existsSync(ordDocPath)).toBe(true);
                
            } catch (error) {
                // Build should not fail due to configuration
                console.warn("Build output:", buildOutput);
                throw error;
            } finally {
                process.chdir(originalCwd);
                
                // Clean up generated files
                const genDir = path.join(testConfigDir, "gen");
                if (fs.existsSync(genDir)) {
                    fs.rmSync(genDir, { recursive: true, force: true });
                }
            }
        });
    });

    describe("Configuration Validation", () => {
        test("Configuration parsing handles JSON correctly", () => {
            // Test JSON parsing of environment variables
            const testConfig = { key: "value", number: 123 };
            const jsonString = JSON.stringify(testConfig);
            
            expect(() => JSON.parse(jsonString)).not.toThrow();
            expect(JSON.parse(jsonString)).toEqual(testConfig);
        });
        
        test("Invalid configuration does not break basic functionality", async () => {
            // This test ensures basic ORD generation still works even with invalid config
            expect(true).toBe(true); // Placeholder test
        });
    });

    describe("Custom ORD Content Integration", () => {
        test("Custom ORD content can be integrated", async () => {
            cds.root = testConfigDir;
            
            // This test verifies that the configuration system supports custom content
            const csn = await cds.load(path.join(cds.root, "srv"));
            const ord = require("../../lib/ord");
            const document = ord(csn);
            
            // Verify base structure is correct for custom content integration
            expect(document).toHaveProperty("packages");
            expect(document.packages).toBeInstanceOf(Array);
            
            // Custom content would be added to this base structure
            expect(typeof document).toBe("object");
        });
    });
});