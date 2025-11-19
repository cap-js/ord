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

    describe("UCL mTLS authentication", () => {
        const mockExpectedSubjects = ["CN=aggregator, O=SAP SE, C=DE", "CN=backup, O=SAP SE, C=US"];

        beforeEach(() => {
            delete process.env.ORD_AUTH_TYPE;
            delete process.env.ORD_UCL_MTLS_SUBJECT_HEADER;
            delete process.env.ORD_UCL_MTLS_EXPECTED_SUBJECTS;
            cds.env.authentication = {};
            cds.env.ord = {};
            cds.env.security = {};
            cds.context = {};
        });

        afterEach(() => {
            delete process.env.ORD_AUTH_TYPE;
            delete process.env.ORD_UCL_MTLS_SUBJECT_HEADER;
            delete process.env.ORD_UCL_MTLS_EXPECTED_SUBJECTS;
            cds.env.authentication = {};
            cds.env.ord = {};
            cds.env.security = {};
            cds.context = {};
        });

        it("should return default configuration with error when UCL mTLS is configured without expectedSubjects", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.UclMtls}"]`;
            const authConfig = createAuthConfig();
            expect(authConfig.error).toEqual("UCL mTLS requires expectedSubjects configuration");
        });

        it("should create auth configuration with UCL mTLS using environment variables", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.UclMtls}"]`;
            process.env.ORD_UCL_MTLS_EXPECTED_SUBJECTS = mockExpectedSubjects.join(",");

            const authConfig = createAuthConfig();
            expect(authConfig.types).toEqual([AUTHENTICATION_TYPE.UclMtls]);
            expect(authConfig.accessStrategies).toEqual([{ type: ORD_ACCESS_STRATEGY.UclMtls }]);
            expect(authConfig.uclMtlsValidator).toBeDefined();
            expect(typeof authConfig.uclMtlsValidator).toBe("function");
            expect(authConfig.uclMtlsHeaderName).toBe("x-forwarded-client-cert");
        });

        it("should create auth configuration with UCL mTLS using cds.env", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.UclMtls}"]`;
            cds.env.ord = {
                uclMtls: {
                    expectedSubjects: mockExpectedSubjects,
                },
            };

            const authConfig = createAuthConfig();
            expect(authConfig.types).toEqual([AUTHENTICATION_TYPE.UclMtls]);
            expect(authConfig.uclMtlsValidator).toBeDefined();
        });

        it("should use custom header name from environment variable", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.UclMtls}"]`;
            process.env.ORD_UCL_MTLS_SUBJECT_HEADER = "x-custom-cert";
            process.env.ORD_UCL_MTLS_EXPECTED_SUBJECTS = mockExpectedSubjects.join(",");

            const authConfig = createAuthConfig();
            expect(authConfig.uclMtlsHeaderName).toBe("x-custom-cert");
        });

        it("should use header name from cds.env.security.authentication.clientCertificateHeader", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.UclMtls}"]`;
            cds.env.security = {
                authentication: {
                    clientCertificateHeader: "x-ssl-cert",
                },
            };
            cds.env.ord = {
                uclMtls: {
                    expectedSubjects: mockExpectedSubjects,
                },
            };

            const authConfig = createAuthConfig();
            expect(authConfig.uclMtlsHeaderName).toBe("x-ssl-cert");
        });

        it("should authenticate with valid certificate subject", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.UclMtls],
                uclMtlsValidator: (req) => ({ ok: true, subject: "CN=aggregator, O=SAP SE, C=DE" }),
            };

            const req = {
                headers: {
                    "x-forwarded-client-cert": "CN=aggregator, O=SAP SE, C=DE",
                },
            };

            await authCheck(req, 200);
            expect(req.uclMtlsSubject).toBe("CN=aggregator, O=SAP SE, C=DE");
        });

        it("should not authenticate with missing certificate header", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.UclMtls],
                uclMtlsValidator: (req) => ({ ok: false, reason: "HEADER_MISSING" }),
            };

            const req = {
                headers: {},
            };

            await authCheck(req, 401, "Client certificate authentication required");
        });

        it("should not authenticate with missing subject in certificate", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.UclMtls],
                uclMtlsValidator: (req) => ({ ok: false, reason: "SUBJECT_MISSING" }),
            };

            const req = {
                headers: {
                    "x-forwarded-client-cert": "Hash=abc123",
                },
            };

            await authCheck(req, 401, "Client certificate authentication required");
        });

        it("should return 403 forbidden for subject mismatch", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.UclMtls],
                uclMtlsValidator: (req) => ({ ok: false, reason: "SUBJECT_MISMATCH", subject: "CN=intruder, O=Evil, C=XX" }),
            };

            const req = {
                headers: {
                    "x-forwarded-client-cert": "CN=intruder, O=Evil, C=XX",
                },
            };

            await authCheck(req, 403, "Forbidden: Invalid client certificate");
        });

        it("should work with full integration using real validator", async () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.UclMtls}"]`;
            process.env.ORD_UCL_MTLS_EXPECTED_SUBJECTS = mockExpectedSubjects.join(",");

            const authConfig = createAuthConfig();
            cds.context = { authConfig };

            const req = {
                headers: {
                    "x-forwarded-client-cert": "CN=aggregator, O=SAP SE, C=DE",
                },
            };

            await authCheck(req, 200);
            expect(req.uclMtlsSubject).toBe("CN=aggregator, O=SAP SE, C=DE");
        });

        it("should work with XFCC-style header format", async () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.UclMtls}"]`;
            process.env.ORD_UCL_MTLS_EXPECTED_SUBJECTS = mockExpectedSubjects.join(",");

            const authConfig = createAuthConfig();
            cds.context = { authConfig };

            const req = {
                headers: {
                    "x-forwarded-client-cert":
                        'Hash=abc123,Subject="CN=backup, O=SAP SE, C=US",URI=spiffe://test,Issuer="CN=CA"',
                },
            };

            await authCheck(req, 200);
            expect(req.uclMtlsSubject).toBe("CN=backup, O=SAP SE, C=US");
        });

        it("should handle subject with different token ordering", async () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.UclMtls}"]`;
            process.env.ORD_UCL_MTLS_EXPECTED_SUBJECTS = mockExpectedSubjects.join(",");

            const authConfig = createAuthConfig();
            cds.context = { authConfig };

            const req = {
                headers: {
                    "x-forwarded-client-cert": "C=DE, O=SAP SE, CN=aggregator",
                },
            };

            await authCheck(req, 200);
        });

        it("should reject certificate with partial match", async () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.UclMtls}"]`;
            process.env.ORD_UCL_MTLS_EXPECTED_SUBJECTS = mockExpectedSubjects.join(",");

            const authConfig = createAuthConfig();
            cds.context = { authConfig };

            const req = {
                headers: {
                    "x-forwarded-client-cert": "CN=aggregator, O=SAP SE",
                },
            };

            await authCheck(req, 403, "Forbidden: Invalid client certificate");
        });

        it("should support combination with Basic auth", async () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.Basic}", "${AUTHENTICATION_TYPE.UclMtls}"]`;
            process.env.BASIC_AUTH = JSON.stringify(mockValidUser);
            process.env.ORD_UCL_MTLS_EXPECTED_SUBJECTS = mockExpectedSubjects.join(",");

            const authConfig = createAuthConfig();
            expect(authConfig.types).toContain(AUTHENTICATION_TYPE.Basic);
            expect(authConfig.types).toContain(AUTHENTICATION_TYPE.UclMtls);
            expect(authConfig.credentials).toBeDefined();
            expect(authConfig.uclMtlsValidator).toBeDefined();
        });

        it("should handle Basic auth when both Basic and UCL mTLS are configured", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.Basic, AUTHENTICATION_TYPE.UclMtls],
                credentials: mockValidUser,
                uclMtlsValidator: (req) => ({ ok: true, subject: "CN=aggregator, O=SAP SE, C=DE" }),
            };

            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from("admin:secret").toString("base64"),
                },
            };

            await authCheck(req, 200);
        });

        it("should handle UCL mTLS when both Basic and UCL mTLS are configured but no Basic header", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.Basic, AUTHENTICATION_TYPE.UclMtls],
                credentials: mockValidUser,
                uclMtlsValidator: (req) => ({ ok: true, subject: "CN=aggregator, O=SAP SE, C=DE" }),
            };

            const req = {
                headers: {
                    "x-forwarded-client-cert": "CN=aggregator, O=SAP SE, C=DE",
                },
            };

            await authCheck(req, 200);
        });
    });
});
