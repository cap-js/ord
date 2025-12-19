// Mock the Logger module
jest.mock("../../lib/logger", () => ({
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
}));

const cds = require("@sap/cds");
const express = require("express");
const request = require("supertest");
const { AUTHENTICATION_TYPE, ORD_ACCESS_STRATEGY, CF_MTLS_HEADERS } = require("../../lib/constants");
const { createAuthMiddleware, createAuthConfig } = require("../../lib/auth/authentication");
const Logger = require("../../lib/logger");

describe("authentication", () => {
    // Constants
    const TEST_ENDPOINT = "/test";
    
    // The bcrypt hash decrypted is: secret
    const mockValidUser = { admin: "$2a$05$cx46X.uaat9Az0XLfc8.BuijktdnHrIvtRMXnLdhozqo.1Eeo7.ZW" };
    const defaultAuthConfig = {
        types: [AUTHENTICATION_TYPE.Open],
        accessStrategies: [{ type: AUTHENTICATION_TYPE.Open }],
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Creates a test Express app with authentication middleware
     * @param {Object} authConfig - Authentication configuration
     * @param {Function} requestHandler - Optional custom request handler to capture req object
     * @returns {Express.Application} Express app for testing
     */
    function createTestApp(authConfig, requestHandler) {
        const app = express();
        const authenticate = createAuthMiddleware(authConfig);

        app.get(TEST_ENDPOINT, authenticate, (req, res) => {
            if (requestHandler) {
                requestHandler(req, res);
            } else {
                res.status(200).send("OK");
            }
        });

        return app;
    }

    describe("Initialization of authentication config data", () => {
        beforeAll(() => {
            delete process.env.BASIC_AUTH;
            cds.env.ord = { authentication: {} };
        });

        afterEach(() => {
            delete process.env.BASIC_AUTH;
            cds.env.ord = { authentication: {} };
        });

        it("should return default configuration when no authentication type is provided", () => {
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual(defaultAuthConfig);
            expect(Logger.info).toHaveBeenCalledWith(
                "createAuthConfig:",
                'No authentication configured. Defaulting to "Open" authentication',
            );
        });

        it("should return default configuration with error when credentials are not valid BCrypt hashes", () => {
            cds.env.ord.authentication.basic = {
                credentials: { admin: "InvalidBCrypHash" },
            };
            const authConfig = createAuthConfig();
            expect(authConfig.error).toEqual("All passwords must be bcrypt hashes");
        });

        it("should automatically ignore Open when combined with Basic authentication", () => {
            cds.env.ord.authentication.basic = { credentials: mockValidUser };
            const authConfig = createAuthConfig();
            // Open should be filtered out automatically when Basic is present
            expect(authConfig.types).toEqual([AUTHENTICATION_TYPE.Basic]);
            expect(authConfig.accessStrategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Basic }]);
            expect(authConfig.credentials).toEqual(mockValidUser);
        });

        it("should return default configuration with error when credentials are not valid JSON", () => {
            process.env.BASIC_AUTH = "non-valid-json";
            const authConfig = createAuthConfig();
            expect(authConfig.error).toEqual(expect.stringContaining("not valid JSON"));
        });

        it("should return auth configuration containing credentials by using data from process.env.BASIC_AUTH", () => {
            process.env.BASIC_AUTH = JSON.stringify(mockValidUser);
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({
                types: [AUTHENTICATION_TYPE.Basic],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Basic }],
                credentials: mockValidUser,
            });
        });

        it("should return auth configuration containing credentials by using data from .cdsrc.json", () => {
            cds.env.ord.authentication.basic = { credentials: mockValidUser };
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({
                types: [AUTHENTICATION_TYPE.Basic],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Basic }],
                credentials: mockValidUser,
            });
        });
    });

    describe("Getting the authentication config data", () => {
        afterAll(() => {
            cds.env.ord = {};
            jest.restoreAllMocks();
        });

        it("should return auth config without caching", () => {
            cds.env.ord = { authentication: {} };

            const authConfig = createAuthConfig();

            expect(authConfig).toEqual(defaultAuthConfig);
        });

        it("should create new config each time createAuthConfig is called", () => {
            cds.env.ord = { authentication: {} };

            const authConfig1 = createAuthConfig();
            const authConfig2 = createAuthConfig();

            expect(authConfig1).toEqual(defaultAuthConfig);
            expect(authConfig2).toEqual(defaultAuthConfig);
            // They should be different objects (not cached at module level)
            expect(authConfig1).not.toBe(authConfig2);
        });

        it("should return error in config when auth configuration is not valid", () => {
            cds.env.ord = { authentication: { basic: { credentials: { admin: "InvalidBCrypHash" } } } };
            const authConfig = createAuthConfig();
            expect(authConfig.error).toBe("All passwords must be bcrypt hashes");
            expect(Logger.error).toHaveBeenCalledWith(
                "createAuthConfig:",
                'Password for user "admin" must be a bcrypt hash'
            );
        });
    });

    describe("Authentication middleware", () => {
        afterEach(() => {
            delete process.env.BASIC_AUTH;
            cds.env.ord = { authentication: {} };
        });

        it("should have access with default open authentication", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Open],
            };
            await request(createTestApp(authConfig)).get(TEST_ENDPOINT).expect(200).expect("OK");
        });

        it("should not authenticate because of missing authorization header in case of any non-open authentication", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
            };

            await request(createTestApp(authConfig)).get(TEST_ENDPOINT).expect(401).expect("Authentication required.");
        });

        it("should not authenticate and set header 'WWW-Authenticate' because of missing authorization header", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
            };

            await request(createTestApp(authConfig))
                .get(TEST_ENDPOINT)
                .expect(401)
                .expect("WWW-Authenticate", /401/)
                .expect("Authentication required.");
        });

        it("should not authenticate because of wrongly configured unsupported authentication type", async () => {
            const authConfig = {
                types: "UnsupportedAuthType",
            };

            await request(createTestApp(authConfig)).get(TEST_ENDPOINT).expect(401).expect("Not authorized");
        });

        it("should not authenticate because of invalid name of authentication type in the request header", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
            };

            await request(createTestApp(authConfig))
                .get(TEST_ENDPOINT)
                .set("Authorization", "Invalid " + Buffer.from("invalid").toString("base64"))
                .expect(401)
                .expect("Invalid authentication type");
        });

        it("should authenticate with valid credentials in the request", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
                credentials: mockValidUser,
            };

            await request(createTestApp(authConfig))
                .get(TEST_ENDPOINT)
                .set("Authorization", "Basic " + Buffer.from("admin:secret").toString("base64"))
                .expect(200)
                .expect("OK");
        });

        it("should not authenticate because of missing password in the request", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
                credentials: mockValidUser,
            };

            await request(createTestApp(authConfig))
                .get(TEST_ENDPOINT)
                .set("Authorization", "Basic " + Buffer.from("admin").toString("base64"))
                .expect(401)
                .expect("Invalid authentication format");
        });

        it("should not authenticate because of invalid credentials in the request", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
                credentials: mockValidUser,
            };

            await request(createTestApp(authConfig))
                .get(TEST_ENDPOINT)
                .set("Authorization", "Basic " + Buffer.from("invalid:invalid").toString("base64"))
                .expect(401)
                .expect("Invalid credentials");
        });
    });

    describe("CF mTLS authentication", () => {
        const mockTrustedCertPairs = [
            {
                issuer: "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                subject: "CN=aggregator, O=SAP SE, C=DE",
            },
            {
                issuer: "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                subject: "CN=backup-service, O=SAP SE, C=US",
            },
        ];

        const mockTrustedRootCaDns = ["CN=SAP Global Root CA, O=SAP SE, C=DE"];

        beforeEach(() => {
            delete process.env.BASIC_AUTH;
            delete process.env.CF_MTLS_TRUSTED_CERTS;
            delete process.env.CF_MTLS_TRUSTED_CERT_PAIRS;
            delete process.env.CF_MTLS_TRUSTED_ROOT_CA_DNS;
            cds.env.ord = { authentication: {} };
        });

        afterEach(() => {
            delete process.env.BASIC_AUTH;
            delete process.env.CF_MTLS_TRUSTED_CERTS;
            delete process.env.CF_MTLS_TRUSTED_CERT_PAIRS;
            delete process.env.CF_MTLS_TRUSTED_ROOT_CA_DNS;
            cds.env.ord = { authentication: {} };
        });

        it("should mark CF mTLS for lazy initialization without immediate validation", () => {
            process.env.CF_MTLS_TRUSTED_CERTS = JSON.stringify({
                certs: mockTrustedCertPairs,
                rootCaDn: mockTrustedRootCaDns,
            });

            const authConfig = createAuthConfig();
            expect(authConfig.types).toEqual([AUTHENTICATION_TYPE.CfMtls]);
            expect(authConfig.accessStrategies).toEqual([{ type: ORD_ACCESS_STRATEGY.CfMtls }]);
            // Validator should be null (lazy loading)
            expect(authConfig.cfMtlsValidator).toBeNull();
            expect(authConfig._cfMtlsInitPromise).toBeNull();
        });

        it("should mark CF mTLS for lazy initialization using cds.env", () => {
            cds.env.ord = {
                authentication: {
                    cfMtls: {
                        certs: mockTrustedCertPairs,
                        rootCaDn: mockTrustedRootCaDns,
                    },
                },
            };

            const authConfig = createAuthConfig();
            expect(authConfig.types).toEqual([AUTHENTICATION_TYPE.CfMtls]);
            // Validator should be null (lazy loading)
            expect(authConfig.cfMtlsValidator).toBeNull();
        });

        it("should authenticate with valid certificate pair and root CA", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.CfMtls],
                cfMtlsValidator: () => ({
                    ok: true,
                    issuer: "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                    subject: "CN=aggregator, O=SAP SE, C=DE",
                    rootCaDn: "CN=SAP Global Root CA, O=SAP SE, C=DE",
                }),
            };

            const issuerDn = "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE";
            const subjectDn = "CN=aggregator, O=SAP SE, C=DE";
            const rootCaDn = "CN=SAP Global Root CA, O=SAP SE, C=DE";

            let capturedReq;
            const app = createTestApp(authConfig, (req, res) => {
                capturedReq = req;
                res.status(200).send("OK");
            });

            await request(app)
                .get(TEST_ENDPOINT)
                .set(CF_MTLS_HEADERS.XFCC, "dummy-xfcc-value")
                .set(CF_MTLS_HEADERS.CLIENT, "1")
                .set(CF_MTLS_HEADERS.CLIENT_VERIFY, "0")
                .set(CF_MTLS_HEADERS.ISSUER, Buffer.from(issuerDn).toString("base64"))
                .set(CF_MTLS_HEADERS.SUBJECT, Buffer.from(subjectDn).toString("base64"))
                .set(CF_MTLS_HEADERS.ROOT_CA, Buffer.from(rootCaDn).toString("base64"))
                .expect(200)
                .expect("OK");

            expect(capturedReq.cfMtlsIssuer).toBe(issuerDn);
            expect(capturedReq.cfMtlsSubject).toBe(subjectDn);
            expect(capturedReq.cfMtlsRootCaDn).toBe(rootCaDn);
        });

        it("should not authenticate with missing XFCC verification headers", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.CfMtls],
                cfMtlsValidator: () => ({
                    ok: false,
                    reason: "XFCC_VERIFICATION_FAILED",
                }),
            };

            await request(createTestApp(authConfig))
                .get(TEST_ENDPOINT)
                .set(CF_MTLS_HEADERS.ISSUER, Buffer.from("CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE").toString("base64"))
                .expect(401)
                .expect("Missing proxy verification of mTLS client certificate");
        });

        it("should not authenticate with missing certificate headers", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.CfMtls],
                cfMtlsValidator: () => ({
                    ok: false,
                    reason: "HEADER_MISSING",
                    missing: CF_MTLS_HEADERS.ISSUER,
                }),
            };

            await request(createTestApp(authConfig))
                .get(TEST_ENDPOINT)
                .set(CF_MTLS_HEADERS.XFCC, "dummy-xfcc-value")
                .set(CF_MTLS_HEADERS.CLIENT, "1")
                .set(CF_MTLS_HEADERS.CLIENT_VERIFY, "0")
                .expect(401)
                .expect("Client certificate authentication required");
        });

        it("should not authenticate with invalid base64 encoding", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.CfMtls],
                cfMtlsValidator: () => ({ ok: false, reason: "INVALID_ENCODING" }),
            };

            await request(createTestApp(authConfig))
                .get(TEST_ENDPOINT)
                .set(CF_MTLS_HEADERS.XFCC, "dummy-xfcc-value")
                .set(CF_MTLS_HEADERS.CLIENT, "1")
                .set(CF_MTLS_HEADERS.CLIENT_VERIFY, "0")
                .set(CF_MTLS_HEADERS.ISSUER, "not-valid-base64!!!")
                .expect(400)
                .expect("Bad Request: Invalid certificate headers");
        });

        it("should return 403 forbidden for certificate pair mismatch", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.CfMtls],
                cfMtlsValidator: () => ({
                    ok: false,
                    reason: "CERT_PAIR_MISMATCH",
                    issuer: "CN=Evil CA, O=Evil Corp, C=XX",
                    subject: "CN=intruder, O=Evil, C=XX",
                }),
            };

            await request(createTestApp(authConfig))
                .get(TEST_ENDPOINT)
                .set(CF_MTLS_HEADERS.XFCC, "dummy-xfcc-value")
                .set(CF_MTLS_HEADERS.CLIENT, "1")
                .set(CF_MTLS_HEADERS.CLIENT_VERIFY, "0")
                .set(CF_MTLS_HEADERS.ISSUER, Buffer.from("CN=Evil CA, O=Evil Corp, C=XX").toString("base64"))
                .set(CF_MTLS_HEADERS.SUBJECT, Buffer.from("CN=intruder, O=Evil, C=XX").toString("base64"))
                .set(CF_MTLS_HEADERS.ROOT_CA, Buffer.from("CN=SAP Global Root CA, O=SAP SE, C=DE").toString("base64"))
                .expect(403)
                .expect("Forbidden: Invalid client certificate");
        });

        it("should return 403 forbidden for root CA mismatch", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.CfMtls],
                cfMtlsValidator: () => ({
                    ok: false,
                    reason: "ROOT_CA_MISMATCH",
                    rootCaDn: "CN=Evil Root CA, O=Evil Corp, C=XX",
                }),
            };

            await request(createTestApp(authConfig))
                .get(TEST_ENDPOINT)
                .set(CF_MTLS_HEADERS.XFCC, "dummy-xfcc-value")
                .set(CF_MTLS_HEADERS.CLIENT, "1")
                .set(CF_MTLS_HEADERS.CLIENT_VERIFY, "0")
                .set(CF_MTLS_HEADERS.ISSUER, Buffer.from("CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE").toString("base64"))
                .set(CF_MTLS_HEADERS.SUBJECT, Buffer.from("CN=aggregator, O=SAP SE, C=DE").toString("base64"))
                .set(CF_MTLS_HEADERS.ROOT_CA, Buffer.from("CN=Evil Root CA, O=Evil Corp, C=XX").toString("base64"))
                .expect(403)
                .expect("Forbidden: Untrusted certificate authority");
        });

        it("should support combination with Basic auth", () => {
            process.env.BASIC_AUTH = JSON.stringify(mockValidUser);
            process.env.CF_MTLS_TRUSTED_CERTS = JSON.stringify({
                certs: mockTrustedCertPairs,
                rootCaDn: mockTrustedRootCaDns,
            });

            const authConfig = createAuthConfig();
            expect(authConfig.types).toContain(AUTHENTICATION_TYPE.Basic);
            expect(authConfig.types).toContain(AUTHENTICATION_TYPE.CfMtls);
            expect(authConfig.credentials).toBeDefined();
            // CF mTLS validator should be null (lazy loading)
            expect(authConfig.cfMtlsValidator).toBeNull();
        });

        it("should handle Basic auth when both Basic and CF mTLS are configured", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic, AUTHENTICATION_TYPE.CfMtls],
                credentials: mockValidUser,
                cfMtlsValidator: () => ({
                    ok: true,
                    issuer: "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                    subject: "CN=aggregator, O=SAP SE, C=DE",
                    rootCaDn: "CN=SAP Global Root CA, O=SAP SE, C=DE",
                }),
            };

            await request(createTestApp(authConfig))
                .get(TEST_ENDPOINT)
                .set("Authorization", "Basic " + Buffer.from("admin:secret").toString("base64"))
                .expect(200)
                .expect("OK");
        });

        it("should handle CF mTLS when both Basic and CF mTLS are configured but no Basic header", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic, AUTHENTICATION_TYPE.CfMtls],
                credentials: mockValidUser,
                cfMtlsValidator: () => ({
                    ok: true,
                    issuer: "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                    subject: "CN=aggregator, O=SAP SE, C=DE",
                    rootCaDn: "CN=SAP Global Root CA, O=SAP SE, C=DE",
                }),
            };

            const issuerDn = "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE";
            const subjectDn = "CN=aggregator, O=SAP SE, C=DE";
            const rootCaDn = "CN=SAP Global Root CA, O=SAP SE, C=DE";

            await request(createTestApp(authConfig))
                .get(TEST_ENDPOINT)
                .set(CF_MTLS_HEADERS.XFCC, "dummy-xfcc-value")
                .set(CF_MTLS_HEADERS.CLIENT, "1")
                .set(CF_MTLS_HEADERS.CLIENT_VERIFY, "0")
                .set(CF_MTLS_HEADERS.ISSUER, Buffer.from(issuerDn).toString("base64"))
                .set(CF_MTLS_HEADERS.SUBJECT, Buffer.from(subjectDn).toString("base64"))
                .set(CF_MTLS_HEADERS.ROOT_CA, Buffer.from(rootCaDn).toString("base64"))
                .expect(200)
                .expect("OK");
        });

        it("should handle Basic auth when both Basic and CF mTLS are configured with Basic header", async () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic, AUTHENTICATION_TYPE.CfMtls],
                credentials: mockValidUser,
            };

            await request(createTestApp(authConfig))
                .get(TEST_ENDPOINT)
                .set("Authorization", "Basic " + Buffer.from("admin:secret").toString("base64"))
                .expect(200)
                .expect("OK");
        });

        it("should support multiple authentication strategies in ORD document", () => {
            cds.env.ord.authentication = {
                basic: { credentials: mockValidUser },
                cfMtls: {
                    certs: mockTrustedCertPairs,
                    rootCaDn: mockTrustedRootCaDns,
                },
            };
            const authConfig = createAuthConfig();

            expect(authConfig.types).toEqual([AUTHENTICATION_TYPE.Basic, AUTHENTICATION_TYPE.CfMtls]);
            expect(authConfig.accessStrategies).toEqual([
                { type: ORD_ACCESS_STRATEGY.Basic },
                { type: ORD_ACCESS_STRATEGY.CfMtls },
            ]);
        });

        it("should automatically filter out Open when combined with CF mTLS", () => {
            cds.env.ord = {
                authentication: {
                    cfMtls: {
                        certs: mockTrustedCertPairs,
                        rootCaDn: mockTrustedRootCaDns,
                    },
                },
            };
            const authConfig = createAuthConfig();

            expect(authConfig.types).toEqual([AUTHENTICATION_TYPE.CfMtls]);
            expect(authConfig.accessStrategies).toEqual([{ type: ORD_ACCESS_STRATEGY.CfMtls }]);
        });

        it("should automatically filter out Open when all three auth types are combined", () => {
            cds.env.ord.authentication = {
                basic: { credentials: mockValidUser },
                cfMtls: {
                    certs: mockTrustedCertPairs,
                    rootCaDn: mockTrustedRootCaDns,
                },
            };
            const authConfig = createAuthConfig();

            // Open should be filtered out, Basic and CfMtls remain
            expect(authConfig.types).toEqual([AUTHENTICATION_TYPE.Basic, AUTHENTICATION_TYPE.CfMtls]);
            expect(authConfig.accessStrategies).toEqual([
                { type: ORD_ACCESS_STRATEGY.Basic },
                { type: ORD_ACCESS_STRATEGY.CfMtls },
            ]);
        });
    });
});
