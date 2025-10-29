const cds = require("@sap/cds");
const { AUTHENTICATION_TYPE, ORD_ACCESS_STRATEGY } = require("../../lib/constants");
const { authenticate, createAuthConfig, getAuthConfig } = require("../../lib/authentication");
const { validateMtlsConfig, createMtlsTestMiddleware } = require("../../lib/middleware/mtlsAuthentication");
const { Logger } = require("../../lib/logger");

// Mock the certificate loader and validator
jest.mock("../../lib/middleware/certificateLoader", () => ({
    getCertificateLoader: jest.fn().mockResolvedValue({
        initialize: jest.fn().mockResolvedValue(undefined),
        getCertificateBySubject: jest.fn().mockReturnValue(undefined),
        getCACertificateDefinitions: jest.fn().mockReturnValue([
            {
                name: "Test CA",
                url: "https://example.com/ca.crt",
            },
        ]),
    }),
    resetCertificateLoader: jest.fn(),
}));

// Mock bcrypt for basic auth
jest.mock("bcryptjs", () => ({
    compare: jest.fn().mockImplementation((password) => Promise.resolve(password === "secret")),
    hash: jest.fn().mockImplementation(() => Promise.resolve("$2b$10$hashedPassword")),
}));

describe("mTLS Authentication", () => {
    // The bcrypt hash for password: secret
    const mockValidUser = { admin: "$2a$05$cx46X.uaat9Az0XLfc8.BuijktdnHrIvtRMXnLdhozqo.1Eeo7.ZW" };

    beforeAll(() => {
        Logger.log = Logger.error = jest.fn();
    });

    afterEach(() => {
        delete process.env.ORD_AUTH_TYPE;
        delete process.env.BASIC_AUTH;
        cds.env.authentication = {};
        cds.context = {};
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    async function authCheck(req, status, message, authConfig = null) {
        if (authConfig) {
            cds.context = { authConfig };
        }

        const res = {
            status: jest.fn().mockImplementation((value) => {
                res.statusCode = value;
                return res;
            }),
            setHeader: jest.fn().mockImplementation((key, value) => {
                res.headers = res.headers || {};
                res.headers[key] = value;
                return res;
            }),
            send: jest.fn().mockImplementation((message) => {
                res.message = message;
                return res;
            }),
        };
        const next = jest.fn();

        try {
            await authenticate(req, res, next);
        } catch (error) {
            if (message) {
                expect(error.message).toBe(message);
            }
            return res;
        }

        if (status) {
            expect(res.statusCode).toBe(status);
        }

        if (message) {
            expect(res.message).toBe(message);
        }

        return res;
    }

    describe("validateMtlsConfig", () => {
        it("should validate valid mTLS configuration", () => {
            const config = {
                mode: "sap:cmp-mtls",
                trustedIssuers: ["CN=Test CA,O=Test,C=US"],
                trustedSubjects: ["CN=Client,O=Test,C=US"],
                decodeBase64Headers: true,
            };

            const result = validateMtlsConfig(config);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it("should reject empty configuration", () => {
            const result = validateMtlsConfig(null);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain("mTLS configuration is required");
        });

        it("should reject unsupported mode", () => {
            const config = {
                mode: "unsupported-mode",
                trustedIssuers: ["CN=Test CA,O=Test,C=US"],
            };

            const result = validateMtlsConfig(config);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain("Unsupported mTLS mode: unsupported-mode. Only 'sap:cmp-mtls' is supported.");
        });

        it("should require at least one configuration option", () => {
            const config = {
                mode: "sap:cmp-mtls",
            };

            const result = validateMtlsConfig(config);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain(
                "SAP CF mTLS mode requires at least one of: trustedIssuers, trustedSubjects, configEndpoints, or caChainFile",
            );
        });

        it("should validate array types", () => {
            const config = {
                mode: "sap:cmp-mtls",
                trustedIssuers: "not an array",
                trustedSubjects: ["CN=Client,O=Test,C=US"],
            };

            const result = validateMtlsConfig(config);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain("trustedIssuers must be an array");
        });

        it("should validate array contents", () => {
            const config = {
                mode: "sap:cmp-mtls",
                trustedIssuers: ["CN=Valid,O=Test,C=US", "", null],
            };

            const result = validateMtlsConfig(config);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain("trustedIssuers[1] must be a non-empty string");
            expect(result.errors).toContain("trustedIssuers[2] must be a non-empty string");
        });
    });

    describe("Authentication Configuration", () => {
        it("should create mTLS configuration from cds.env", () => {
            cds.env.authentication = {
                types: [AUTHENTICATION_TYPE.MTLS],
                mtls: {
                    mode: "sap:cmp-mtls",
                    trustedIssuers: ["CN=Test CA,O=Test,C=US"],
                    trustedSubjects: ["CN=Client,O=Test,C=US"],
                },
            };

            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({
                types: [AUTHENTICATION_TYPE.MTLS],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.MTLS }],
                mtls: {
                    mode: "sap:cmp-mtls",
                    trustedIssuers: ["CN=Test CA,O=Test,C=US"],
                    trustedSubjects: ["CN=Client,O=Test,C=US"],
                },
            });
        });

        it("should reject invalid mTLS configuration", () => {
            cds.env.authentication = {
                types: [AUTHENTICATION_TYPE.MTLS],
                mtls: {
                    mode: "unsupported-mode",
                },
            };

            const authConfig = createAuthConfig();
            expect(authConfig.error).toBe("Invalid mTLS configuration");
        });

        it("should support combined mTLS and Basic authentication", () => {
            cds.env.authentication = {
                types: [AUTHENTICATION_TYPE.MTLS, AUTHENTICATION_TYPE.Basic],
                credentials: mockValidUser,
                mtls: {
                    mode: "sap:cmp-mtls",
                    trustedIssuers: ["CN=Test CA,O=Test,C=US"],
                },
            };

            const authConfig = createAuthConfig();
            expect(authConfig.types).toContain(AUTHENTICATION_TYPE.MTLS);
            expect(authConfig.types).toContain(AUTHENTICATION_TYPE.Basic);
            expect(authConfig.credentials).toEqual(mockValidUser);
            expect(authConfig.mtls).toBeDefined();
        });

        it("should reject Open combined with mTLS", () => {
            cds.env.authentication = {
                types: [AUTHENTICATION_TYPE.Open, AUTHENTICATION_TYPE.MTLS],
                mtls: {
                    mode: "sap:cmp-mtls",
                    trustedIssuers: ["CN=Test CA,O=Test,C=US"],
                },
            };

            const authConfig = createAuthConfig();
            expect(authConfig.error).toBe("Open authentication cannot be combined with any other authentication type");
        });
    });

    describe("mTLS Test Middleware", () => {
        it("should create test middleware that authenticates requests", () => {
            const config = {
                mode: "sap:cmp-mtls",
                trustedIssuers: ["CN=Test CA,O=Test,C=US"],
            };

            const middleware = createMtlsTestMiddleware(config);

            const req = {
                headers: {
                    "x-ssl-client-verify": "0",
                    "x-ssl-client-subject-dn": "CN=test-client,O=Test,C=US",
                },
            };
            const res = {};
            const next = jest.fn();

            middleware(req, res, next);

            expect(req.isMtlsAuthenticated).toBe(true);
            expect(req.clientCertificate).toBeDefined();
            expect(req.clientCertificate.subject.CN).toBe("test-client");
            expect(next).toHaveBeenCalled();
        });
    });

    describe("Authentication Middleware Integration", () => {
        it("should handle Open authentication", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Open],
            };

            const req = { headers: {} };
            const res = await authCheck(req, 200, null, authConfig);
            expect(res.statusCode).toBe(200);
        });

        it("should handle Basic authentication", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
                credentials: mockValidUser,
            };

            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from("admin:secret").toString("base64"),
                },
            };

            const res = await authCheck(req, 200, null, authConfig);
            expect(res.statusCode).toBe(200);
        });

        it("should reject invalid Basic credentials", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
                credentials: mockValidUser,
            };

            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from("admin:wrong").toString("base64"),
                },
            };

            const res = await authCheck(req, 401, "Invalid credentials", authConfig);
            expect(res.statusCode).toBe(401);
        });

        it("should require authentication when no method succeeds", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
                credentials: mockValidUser,
            };

            const req = { headers: {} };
            const res = await authCheck(req, 401, "Authentication required.", authConfig);
            expect(res.statusCode).toBe(401);
        });
    });

    describe("Error Handling", () => {
        it("should handle authentication configuration errors", () => {
            cds.context = {};
            process.env.ORD_AUTH_TYPE = '["invalid"]';

            expect(() => getAuthConfig()).toThrow("Invalid authentication configuration");
        });

        it("should log errors appropriately", () => {
            cds.env.authentication = {
                types: [AUTHENTICATION_TYPE.MTLS],
                mtls: {
                    mode: "invalid-mode",
                },
            };

            createAuthConfig();
            expect(Logger.error).toHaveBeenCalledWith(
                "createAuthConfig:",
                expect.stringContaining("mTLS configuration errors"),
            );
        });
    });
});
