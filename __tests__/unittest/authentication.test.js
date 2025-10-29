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
            process.env.ORD_AUTH_TYPE = AUTHENTICATION_TYPE.Open;
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual(defaultAuthConfig);
        });

        it("should return default configuration with error when invalid authentication type is provided", () => {
            process.env.ORD_AUTH_TYPE = "InvalidType";
            const authConfig = createAuthConfig();
            expect(authConfig.error).toEqual("Invalid authentication type");
        });

        it("should return default configuration with error when Open and Basic authentication types are combined", () => {
            process.env.ORD_AUTH_TYPE = `${AUTHENTICATION_TYPE.Open},${AUTHENTICATION_TYPE.Basic}`;
            const authConfig = createAuthConfig();
            expect(authConfig.error).toEqual(
                "Open authentication cannot be combined with any other authentication type",
            );
        });

        it("should return auth configuration containing credentials by using legacy JSON format", () => {
            process.env.ORD_AUTH_TYPE = `["${AUTHENTICATION_TYPE.Basic}"]`;
            process.env.BASIC_AUTH = JSON.stringify(mockValidUser);
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({
                types: [AUTHENTICATION_TYPE.Basic],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Basic }],
                credentials: mockValidUser,
            });
        });

        it("should return auth configuration containing credentials by using GitHub Actions compatible format", () => {
            process.env.ORD_AUTH_TYPE = AUTHENTICATION_TYPE.Basic;
            process.env.BASIC_AUTH_USERNAME = 'admin';
            process.env.BASIC_AUTH_HASH = mockValidUser.admin;
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({
                types: [AUTHENTICATION_TYPE.Basic],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Basic }],
                credentials: mockValidUser,
            });
        });

        it("should return auth configuration containing credentials by using data from .cdsrc.json (legacy flat structure)", () => {
            process.env.ORD_AUTH_TYPE = AUTHENTICATION_TYPE.Basic;
            cds.env.authentication.credentials = mockValidUser;
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({
                types: [AUTHENTICATION_TYPE.Basic],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Basic }],
                credentials: mockValidUser,
            });
        });

        it("should return auth configuration containing credentials by using new nested structure", () => {
            process.env.ORD_AUTH_TYPE = AUTHENTICATION_TYPE.Basic;
            cds.env.authentication.basic = { credentials: mockValidUser };
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({
                types: [AUTHENTICATION_TYPE.Basic],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Basic }],
                credentials: mockValidUser,
            });
        });

        it("should prefer new nested structure over legacy flat structure when both are present", () => {
            process.env.ORD_AUTH_TYPE = AUTHENTICATION_TYPE.Basic;
            const nestedCredentials = { admin: "$2a$05$cx46X.uaat9Az0XLfc8.BuijktdnHrIvtRMXnLdhozqo.1Eeo7.ZW" };
            cds.env.authentication.basic = { credentials: nestedCredentials };
            cds.env.authentication.credentials = mockValidUser; // This should be ignored
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({
                types: [AUTHENTICATION_TYPE.Basic],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Basic }],
                credentials: nestedCredentials,
            });
        });

        it("should return error when basic authentication is configured but no credentials are found", () => {
            process.env.ORD_AUTH_TYPE = AUTHENTICATION_TYPE.Basic;
            // Clear all credential sources
            delete process.env.BASIC_AUTH_USERNAME;
            delete process.env.BASIC_AUTH_HASH;
            cds.env.authentication = {}; // No credentials in CDS config
            const authConfig = createAuthConfig();
            expect(authConfig.error).toEqual("Basic authentication requires credentials");
        });

        it("should return default configuration with error when credentials are not valid BCrypt hashes", () => {
            process.env.ORD_AUTH_TYPE = AUTHENTICATION_TYPE.Basic;
            process.env.BASIC_AUTH_USERNAME = "admin";
            process.env.BASIC_AUTH_HASH = "InvalidBCrypHash";
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
});
