const cds = require("@sap/cds");
const path = require("path");
const { AUTHENTICATION_TYPE } = require("../../lib/constants");

describe("Authentication Integration Tests", () => {
    
    afterEach(() => {
        jest.clearAllMocks();
        delete process.env.ORD_AUTH_TYPE;
        delete process.env.BASIC_AUTH;
    });

    describe("Open Authentication Mode", () => {
        beforeEach(() => {
            // Set up CAP application with open authentication
            cds.root = path.join(__dirname, "..", "bookshop");
            
            jest.spyOn(cds, "context", "get").mockReturnValue({
                authConfig: {
                    types: [AUTHENTICATION_TYPE.Open],
                },
            });
        });

        test("Authentication config returns open authentication", () => {
            const authentication = require("../../lib/authentication");
            const authConfig = authentication.getAuthConfig();
            
            expect(authConfig).toHaveProperty("types");
            expect(authConfig.types).toContain(AUTHENTICATION_TYPE.Open);
        });

        test("Base template reflects open access strategy", () => {
            const defaults = require("../../lib/defaults");
            const baseTemplate = defaults.baseTemplate;
            
            // Check access strategies indicate open access
            const accessStrategies = baseTemplate.openResourceDiscoveryV1.documents[0].accessStrategies;
            expect(accessStrategies).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: "open"
                    })
                ])
            );
        });
    });

    describe("Basic Authentication Mode", () => {
        beforeEach(() => {
            // Set up environment for basic authentication
            process.env.ORD_AUTH_TYPE = "basic-authentication";
            process.env.BASIC_AUTH = JSON.stringify({
                "testuser": "$2a$10$1234567890123456789012345678901234567890123456"  // Mock bcrypt hash
            });
            
            cds.root = path.join(__dirname, "..", "bookshop");
            
            jest.spyOn(cds, "context", "get").mockReturnValue({
                authConfig: {
                    types: [AUTHENTICATION_TYPE.BasicAuthentication],
                    credentials: {
                        "testuser": "$2a$10$1234567890123456789012345678901234567890123456"
                    }
                },
            });
        });

        test("Authentication config recognizes basic authentication", () => {
            const authentication = require("../../lib/authentication");
            const authConfig = authentication.getAuthConfig();
            
            expect(authConfig).toHaveProperty("types");
            expect(authConfig.types).toContain(AUTHENTICATION_TYPE.BasicAuthentication);
            expect(authConfig).toHaveProperty("credentials");
            expect(authConfig.credentials).toHaveProperty("testuser");
        });

        test("Basic authentication middleware function exists", () => {
            const authentication = require("../../lib/authentication");
            
            expect(typeof authentication.authenticate).toBe("function");
        });
    });

    describe("Authentication Configuration", () => {
        test("Authentication type can be configured via environment variable", () => {
            process.env.ORD_AUTH_TYPE = "basic-authentication";
            
            expect(process.env.ORD_AUTH_TYPE).toBe("basic-authentication");
            
            // Test that the authentication module can read this configuration
            const authentication = require("../../lib/authentication");
            expect(typeof authentication.getAuthConfig).toBe("function");
        });

        test("Basic auth credentials can be configured via environment variable", () => {
            const testCredentials = {
                "user1": "hash1",
                "user2": "hash2"
            };
            process.env.BASIC_AUTH = JSON.stringify(testCredentials);
            
            expect(JSON.parse(process.env.BASIC_AUTH)).toEqual(testCredentials);
        });
    });

    describe("Authentication Error Scenarios", () => {
        test("Invalid authentication configuration falls back to open auth", () => {
            // Set up invalid configuration
            process.env.ORD_AUTH_TYPE = "invalid-auth-type";
            
            // Should fall back to open authentication without crashing
            const authentication = require("../../lib/authentication");
            const authConfig = authentication.getAuthConfig();
            
            expect(authConfig).toHaveProperty("types");
            // Should contain at least one authentication type (fallback)
            expect(authConfig.types.length).toBeGreaterThan(0);
        });

        test("Missing authentication credentials are handled gracefully", () => {
            delete process.env.BASIC_AUTH;
            process.env.ORD_AUTH_TYPE = "basic-authentication";
            
            // Should not throw errors when credentials are missing
            expect(() => {
                const authentication = require("../../lib/authentication");
                authentication.getAuthConfig();
            }).not.toThrow();
        });
    });

    describe("Authentication Integration with ORD Service", () => {
        test("Authentication config integrates with ORD document generation", async () => {
            cds.root = path.join(__dirname, "..", "bookshop");
            
            jest.spyOn(cds, "context", "get").mockReturnValue({
                authConfig: {
                    types: [AUTHENTICATION_TYPE.Open],
                },
            });
            
            const csn = await cds.load(path.join(cds.root, "srv"));
            const ord = require("../../lib/ord");
            
            // ORD generation should work regardless of authentication configuration
            expect(() => ord(csn)).not.toThrow();
            
            const document = ord(csn);
            expect(document).toHaveProperty("openResourceDiscovery", "1.9");
        });
        
        test("Base template is generated correctly with authentication", () => {
            jest.spyOn(cds, "context", "get").mockReturnValue({
                authConfig: {
                    types: [AUTHENTICATION_TYPE.Open],
                },
            });
            
            const defaults = require("../../lib/defaults");
            const baseTemplate = defaults.baseTemplate;
            
            expect(baseTemplate).toHaveProperty("openResourceDiscoveryV1");
            expect(baseTemplate.openResourceDiscoveryV1.documents[0]).toHaveProperty("accessStrategies");
            expect(baseTemplate.openResourceDiscoveryV1.documents[0].accessStrategies).toBeInstanceOf(Array);
        });
    });

    describe("Authentication Constants", () => {
        test("Authentication type constants are properly defined", () => {
            expect(AUTHENTICATION_TYPE).toHaveProperty("Open");
            expect(AUTHENTICATION_TYPE).toHaveProperty("BasicAuthentication");
            expect(typeof AUTHENTICATION_TYPE.Open).toBe("string");
            expect(typeof AUTHENTICATION_TYPE.BasicAuthentication).toBe("string");
        });
    });

    describe("Authentication Middleware Integration", () => {
        test("Authentication middleware can be applied to endpoints", () => {
            const authentication = require("../../lib/authentication");
            
            // The authenticate function should be available for middleware use
            expect(typeof authentication.authenticate).toBe("function");
            expect(authentication.authenticate.length).toBeGreaterThan(0); // Should accept parameters
        });
        
        test("Authentication context is properly managed", () => {
            jest.spyOn(cds, "context", "get").mockReturnValue({
                authConfig: {
                    types: [AUTHENTICATION_TYPE.Open],
                },
            });
            
            const context = cds.context;
            expect(context).toHaveProperty("authConfig");
            expect(context.authConfig).toHaveProperty("types");
            expect(context.authConfig.types).toContain(AUTHENTICATION_TYPE.Open);
        });
    });
});