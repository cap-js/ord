const cds = require("@sap/cds");
const { AUTHENTICATION_TYPE, ORD_ACCESS_STRATEGY } = require("../../lib/constants");
const { authenticate, createAuthConfig, getAuthConfig } = require("../../lib/authentication");
const { Logger } = require("../../lib/logger");

describe("authentication", () => {
    // The bcrypt hash decrypted is: secret
    const mockValidUser = { admin: "$2a$05$cx46X.uaat9Az0XLfc8.BuijktdnHrIvtRMXnLdhozqo.1Eeo7.ZW" };
    const defaultAuthConfig = {
        types: [AUTHENTICATION_TYPE.Open],
        accessStrategies: [{ type: AUTHENTICATION_TYPE.Open }],
    };

    cds.context = {
        authConfig: {
            types: [AUTHENTICATION_TYPE.Open],
        },
    };

    beforeAll(() => {
        Logger.log = Logger.error = jest.fn();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    async function authCheck(req, status, message, header) {
        const res = {
            status: jest.fn().mockImplementation((value) => {
                res.status = value;
                return res;
            }),
            setHeader: jest.fn().mockImplementation((key, value) => {
                res.header = { [key]: value };
                return res;
            }),
            end: jest.fn(),
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
            return;
        }

        if (status) {
            expect(res.status).toBe(status);
        }

        if (message) {
            expect(res.message).toBe(message);
        }

        if (header) {
            expect(res.header["WWW-Authenticate"]).toEqual(expect.stringContaining(header));
        }
    }

    describe("Initialization of authentication config data", () => {
        beforeAll(() => {
            delete process.env.ORD_AUTH_TYPE;
            delete process.env.BASIC_AUTH;
            cds.env.authentication = {};
        });

        afterEach(() => {
            delete process.env.ORD_AUTH_TYPE;
            delete process.env.BASIC_AUTH;
            cds.env.authentication = {};
        });

        it("should return default configuration when no authentication type is provided", () => {
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual(defaultAuthConfig);
            expect(Logger.error).toHaveBeenCalledWith(
                "createAuthConfig:",
                'No authorization type is provided. Defaulting to "Open" authentication',
            );
        });

        it("should return configuration when Open authentication type is provided", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.Open}"]`;
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual(defaultAuthConfig);
        });

        it("should return default configuration with error when invalid authentication type is provided", () => {
            process.env.ORD_AUTH_TYPE = '["InvalidType"]';
            const authConfig = createAuthConfig();
            expect(authConfig.error).toEqual("Invalid authentication type");
        });

        it("should return default configuration with error when Open and Basic authentication types are combined", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.Open}", "${AUTHENTICATION_TYPE.Basic}"]`;
            const authConfig = createAuthConfig();
            expect(authConfig.error).toEqual(
                "Open authentication cannot be combined with any other authentication type",
            );
        });

        it("should return default configuration with error when invalid JSON is provided", () => {
            process.env.ORD_AUTH_TYPE = 'typo["Open"typo]';
            const authConfig = createAuthConfig();
            expect(authConfig.error).toEqual(expect.stringContaining("not valid JSON"));
        });

        it("should return default configuration with error when credentials are not valid JSON", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.Basic}"]`;
            process.env.BASIC_AUTH = "non-valid-json";
            const authConfig = createAuthConfig();
            expect(authConfig.error).toEqual(expect.stringContaining("not valid JSON"));
        });

        it("should return auth configuration containing credentials by using data from process.env.BASIC_AUTH", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.Basic}"]`;
            process.env.BASIC_AUTH = JSON.stringify(mockValidUser);
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({
                types: [AUTHENTICATION_TYPE.Basic],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Basic }],
                credentials: mockValidUser,
            });
        });

        it("should return auth configuration containing credentials by using data from .cdsrc.json", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.Basic}"]`;
            cds.env.authentication.credentials = mockValidUser;
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({
                types: [AUTHENTICATION_TYPE.Basic],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Basic }],
                credentials: mockValidUser,
            });
        });
        it("should return default configuration with error when credentials are not valid BCrypt hashes", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.Basic}"]`;
            process.env.BASIC_AUTH = JSON.stringify({
                admin: "InvalidBCrypHash",
            });
            const authConfig = createAuthConfig();
            expect(authConfig.error).toEqual("All passwords must be bcrypt hashes");
        });
    });

    describe("Getting the authentication config data", () => {
        afterAll(() => {
            delete process.env.ORD_AUTH_TYPE;
            cds.context = {};
            jest.restoreAllMocks();
        });

        it("should return auth config from cds.context if provided", () => {
            cds.context = {
                authConfig: defaultAuthConfig,
            };
            const authConfig = getAuthConfig();
            expect(authConfig).toEqual(cds.context.authConfig);
        });

        it("should run createAuthConfig if cds.context undefined", () => {
            cds.context = {};
            const authConfig = getAuthConfig();

            expect(authConfig).toEqual(defaultAuthConfig);
            expect(authConfig).toEqual(cds.context.authConfig);
        });

        it("should run createAuthConfig if cds.context undefined", () => {
            cds.context = {};

            const authConfig = getAuthConfig();

            expect(authConfig).toEqual(defaultAuthConfig);
            expect(authConfig).toEqual(cds.context.authConfig);
        });

        it("should throw an error when auth configuration is not valid", () => {
            cds.context = {};
            process.env.ORD_AUTH_TYPE = '["InvalidType"]';
            Logger.error = jest.fn();

            expect(() => getAuthConfig()).toThrow("Invalid authentication configuration");
            expect(Logger.error).toHaveBeenCalledTimes(1);
        });
    });

    describe("Authentication middleware", () => {
        afterEach(() => {
            delete process.env.ORD_AUTH_TYPE;
            delete process.env.BASIC_AUTH;
            cds.env.authentication = {};
            cds.context.authConfig = {};
        });

        it("should have access with default open authentication", async () => {
            await authCheck({ headers: {} }, 200);
        });

        it("should not authenticate because of missing authorization header in case of any non-open authentication", async () => {
            cds.context.authConfig.types = [AUTHENTICATION_TYPE.Basic];
            const req = {
                headers: {},
            };

            await authCheck(req, 401, "Authentication required.");
        });

        it("should not authenticate and set header 'WWW-Authenticate' because of missing authorization header", async () => {
            cds.context.authConfig.types = [AUTHENTICATION_TYPE.Basic];
            const req = {
                headers: {},
            };

            await authCheck(req, 401, "Authentication required.", "401");
        });

        it("should not authenticate because of wrongly configured unsupported authentication type", async () => {
            cds.context.authConfig.types = "UnsupportedAuthType";
            const req = {
                headers: {},
            };

            await authCheck(req, 401, "Not authorized");
        });

        it("should not authenticate because of invalid name of authentication type in the request header", async () => {
            cds.context.authConfig.types = [AUTHENTICATION_TYPE.Basic];
            const req = {
                headers: {
                    authorization: "Invalid " + Buffer.from(`invalid`).toString("base64"),
                },
            };
            await authCheck(req, 401, "Invalid authentication type");
        });

        it("should authenticate with valid credentials in the request", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
                credentials: mockValidUser,
            };

            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from("admin:secret").toString("base64"),
                },
            };
            await authCheck(req, 200);
        });

        it("should not authenticate because of missing password in the request", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
                credentials: mockValidUser,
            };

            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from("admin:").toString("base64"),
                },
            };

            await authCheck(req, 401, "Password and hashed password are required");
        });

        it("should not authenticate because of invalid credentials in the request", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
                credentials: mockValidUser,
            };

            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from("invalid:invalid").toString("base64"),
                },
            };
            await authCheck(req, 401, "Invalid credentials");
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
            delete process.env.ORD_AUTH_TYPE;
            delete process.env.CF_MTLS_TRUSTED_CERT_PAIRS;
            delete process.env.CF_MTLS_TRUSTED_ROOT_CA_DNS;
            cds.env.authentication = {};
            cds.env.ord = {};
            cds.context = {};
        });

        afterEach(() => {
            delete process.env.ORD_AUTH_TYPE;
            delete process.env.CF_MTLS_TRUSTED_CERT_PAIRS;
            delete process.env.CF_MTLS_TRUSTED_ROOT_CA_DNS;
            cds.env.authentication = {};
            cds.env.ord = {};
            cds.context = {};
        });

        it("should return default configuration with error when CF mTLS is configured without trustedCertPairs", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.CfMtls}"]`;
            process.env.CF_MTLS_TRUSTED_ROOT_CA_DNS = JSON.stringify(mockTrustedRootCaDns);
            const authConfig = createAuthConfig();
            expect(authConfig.error).toEqual("CF mTLS requires trustedCertPairs configuration");
        });

        it("should return default configuration with error when CF mTLS is configured without trustedRootCaDns", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.CfMtls}"]`;
            process.env.CF_MTLS_TRUSTED_CERT_PAIRS = JSON.stringify(mockTrustedCertPairs);
            const authConfig = createAuthConfig();
            expect(authConfig.error).toEqual("CF mTLS requires trustedRootCaDns configuration");
        });

        it("should create auth configuration with CF mTLS using environment variables", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.CfMtls}"]`;
            process.env.CF_MTLS_TRUSTED_CERT_PAIRS = JSON.stringify(mockTrustedCertPairs);
            process.env.CF_MTLS_TRUSTED_ROOT_CA_DNS = JSON.stringify(mockTrustedRootCaDns);

            const authConfig = createAuthConfig();
            expect(authConfig.types).toEqual([AUTHENTICATION_TYPE.CfMtls]);
            expect(authConfig.accessStrategies).toEqual([{ type: ORD_ACCESS_STRATEGY.CfMtls }]);
            expect(authConfig.cfMtlsValidator).toBeDefined();
            expect(typeof authConfig.cfMtlsValidator).toBe("function");
        });

        it("should create auth configuration with CF mTLS using cds.env", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.CfMtls}"]`;
            cds.env.ord = {
                cfMtls: {
                    trustedCertPairs: mockTrustedCertPairs,
                    trustedRootCaDns: mockTrustedRootCaDns,
                },
            };

            const authConfig = createAuthConfig();
            expect(authConfig.types).toEqual([AUTHENTICATION_TYPE.CfMtls]);
            expect(authConfig.cfMtlsValidator).toBeDefined();
        });

        it("should authenticate with valid certificate pair and root CA", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.CfMtls],
                cfMtlsValidator: (req) => ({
                    ok: true,
                    issuer: "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                    subject: "CN=aggregator, O=SAP SE, C=DE",
                    rootCaDn: "CN=SAP Global Root CA, O=SAP SE, C=DE",
                }),
            };

            const issuerDn = "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE";
            const subjectDn = "CN=aggregator, O=SAP SE, C=DE";
            const rootCaDn = "CN=SAP Global Root CA, O=SAP SE, C=DE";

            const req = {
                headers: {
                    "x-forwarded-client-cert-issuer-dn": Buffer.from(issuerDn).toString("base64"),
                    "x-forwarded-client-cert-subject-dn": Buffer.from(subjectDn).toString("base64"),
                    "x-forwarded-client-cert-root-ca-dn": Buffer.from(rootCaDn).toString("base64"),
                },
            };

            await authCheck(req, 200);
            expect(req.cfMtlsIssuer).toBe(issuerDn);
            expect(req.cfMtlsSubject).toBe(subjectDn);
            expect(req.cfMtlsRootCaDn).toBe(rootCaDn);
        });

        it("should not authenticate with missing certificate headers", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.CfMtls],
                cfMtlsValidator: (req) => ({ ok: false, reason: "HEADER_MISSING", missing: "x-forwarded-client-cert-issuer-dn" }),
            };

            const req = {
                headers: {},
            };

            await authCheck(req, 401, "Client certificate authentication required");
        });

        it("should not authenticate with invalid base64 encoding", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.CfMtls],
                cfMtlsValidator: (req) => ({ ok: false, reason: "INVALID_ENCODING" }),
            };

            const req = {
                headers: {
                    "x-forwarded-client-cert-issuer-dn": "not-valid-base64!!!",
                },
            };

            await authCheck(req, 400, "Bad Request: Invalid certificate headers");
        });

        it("should return 403 forbidden for certificate pair mismatch", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.CfMtls],
                cfMtlsValidator: (req) => ({
                    ok: false,
                    reason: "CERT_PAIR_MISMATCH",
                    issuer: "CN=Evil CA, O=Evil Corp, C=XX",
                    subject: "CN=intruder, O=Evil, C=XX",
                }),
            };

            const req = {
                headers: {
                    "x-forwarded-client-cert-issuer-dn": Buffer.from("CN=Evil CA, O=Evil Corp, C=XX").toString("base64"),
                    "x-forwarded-client-cert-subject-dn": Buffer.from("CN=intruder, O=Evil, C=XX").toString("base64"),
                    "x-forwarded-client-cert-root-ca-dn": Buffer.from("CN=SAP Global Root CA, O=SAP SE, C=DE").toString("base64"),
                },
            };

            await authCheck(req, 403, "Forbidden: Invalid client certificate");
        });

        it("should return 403 forbidden for root CA mismatch", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.CfMtls],
                cfMtlsValidator: (req) => ({
                    ok: false,
                    reason: "ROOT_CA_MISMATCH",
                    rootCaDn: "CN=Evil Root CA, O=Evil Corp, C=XX",
                }),
            };

            const req = {
                headers: {
                    "x-forwarded-client-cert-issuer-dn": Buffer.from("CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE").toString("base64"),
                    "x-forwarded-client-cert-subject-dn": Buffer.from("CN=aggregator, O=SAP SE, C=DE").toString("base64"),
                    "x-forwarded-client-cert-root-ca-dn": Buffer.from("CN=Evil Root CA, O=Evil Corp, C=XX").toString("base64"),
                },
            };

            await authCheck(req, 403, "Forbidden: Untrusted certificate authority");
        });

        it("should support combination with Basic auth", async () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.Basic}", "${AUTHENTICATION_TYPE.CfMtls}"]`;
            process.env.BASIC_AUTH = JSON.stringify(mockValidUser);
            process.env.CF_MTLS_TRUSTED_CERT_PAIRS = JSON.stringify(mockTrustedCertPairs);
            process.env.CF_MTLS_TRUSTED_ROOT_CA_DNS = JSON.stringify(mockTrustedRootCaDns);

            const authConfig = createAuthConfig();
            expect(authConfig.types).toContain(AUTHENTICATION_TYPE.Basic);
            expect(authConfig.types).toContain(AUTHENTICATION_TYPE.CfMtls);
            expect(authConfig.credentials).toBeDefined();
            expect(authConfig.cfMtlsValidator).toBeDefined();
        });

        it("should handle Basic auth when both Basic and CF mTLS are configured", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.Basic, AUTHENTICATION_TYPE.CfMtls],
                credentials: mockValidUser,
                cfMtlsValidator: (req) => ({
                    ok: true,
                    issuer: "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                    subject: "CN=aggregator, O=SAP SE, C=DE",
                    rootCaDn: "CN=SAP Global Root CA, O=SAP SE, C=DE",
                }),
            };

            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from("admin:secret").toString("base64"),
                },
            };

            await authCheck(req, 200);
        });

        it("should handle CF mTLS when both Basic and CF mTLS are configured but no Basic header", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.Basic, AUTHENTICATION_TYPE.CfMtls],
                credentials: mockValidUser,
                cfMtlsValidator: (req) => ({
                    ok: true,
                    issuer: "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                    subject: "CN=aggregator, O=SAP SE, C=DE",
                    rootCaDn: "CN=SAP Global Root CA, O=SAP SE, C=DE",
                }),
            };

            const issuerDn = "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE";
            const subjectDn = "CN=aggregator, O=SAP SE, C=DE";
            const rootCaDn = "CN=SAP Global Root CA, O=SAP SE, C=DE";

            const req = {
                headers: {
                    "x-forwarded-client-cert-issuer-dn": Buffer.from(issuerDn).toString("base64"),
                    "x-forwarded-client-cert-subject-dn": Buffer.from(subjectDn).toString("base64"),
                    "x-forwarded-client-cert-root-ca-dn": Buffer.from(rootCaDn).toString("base64"),
                },
            };

            await authCheck(req, 200);
        });
    });
});
