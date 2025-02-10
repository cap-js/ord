const cds = require('@sap/cds');
const { AUTHENTICATION_TYPE, CERT_SUBJECT_HEADER_KEY } = require('../../lib/constants');
const { authenticate, createAuthConfig, getAuthenticationTypes } = require('../../lib/authentication');
const { Logger } = require('../../lib/logger');

describe('authentication', () => {
    const mockValidUser = { admin: "secret" };
    cds.context = {
        authConfig: {
            types: [AUTHENTICATION_TYPE.Open]
        }
    };

    beforeAll(() => {
        Logger.log = Logger.error = jest.fn();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    function authCheck(req, status, message, header) {
        const res = {
            status: jest.fn().mockImplementation(value => { res.status = value; return res; }),
            setHeader: jest.fn().mockImplementation((key, value) => { res.header = { [key]: value }; return res; }),
            end: jest.fn(),
            send: jest.fn().mockImplementation(message => { res.message = message; return res; })
        };
        const next = jest.fn();

        authenticate(req, res, next);

        if (status) {
            expect(res.status).toBe(status);
        }

        if (message) {
            expect(res.message).toBe(message);
        }

        if (header) {
            expect(res.header['WWW-Authenticate']).toEqual(expect.stringContaining(header));
        }
    }

    describe('Initialization of authentication config data', () => {
        beforeAll(() => {
            delete process.env.ORD_AUTH;
            delete process.env.APP_USER;
            cds.env.authentication = {};
        });

        afterEach(() => {
            delete process.env.ORD_AUTH;
            delete process.env.APP_USER;
            cds.env.authentication = {};
        });

        it('should return array of authentication types from environment variables: Basic auth', () => {
            process.env.ORD_AUTH = `["${AUTHENTICATION_TYPE.Basic}"]`;
            const authTypes = getAuthenticationTypes();
            expect(authTypes).toEqual([AUTHENTICATION_TYPE.Basic]);
        });

        it('should return default configuration when no authentication type is provided', () => {
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({ types: [AUTHENTICATION_TYPE.Open] });
            expect(Logger.error).toHaveBeenCalledWith('createAuthConfig:', 'No authorization type is provided. Defaulting to "Open" authentication');
        });


        it('should return configuration when Open authentication type is provided', () => {
            process.env.ORD_AUTH = `["${AUTHENTICATION_TYPE.Open}"]`;
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({ types: [AUTHENTICATION_TYPE.Open] });
        });

        it('should return default configuration when invalid authentication type is provided', () => {
            process.env.ORD_AUTH = '["InvalidType"]';
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({ types: [AUTHENTICATION_TYPE.Open] });
            expect(Logger.error).toHaveBeenCalledWith('createAuthConfig:', 'Invalid authentication type');
        });

        it('should return default configuration when Open and Basic authentication types are combined', () => {
            process.env.ORD_AUTH = `["${AUTHENTICATION_TYPE.Open}", "${AUTHENTICATION_TYPE.Basic}"]`;
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({ types: [AUTHENTICATION_TYPE.Open] });
            expect(Logger.error).toHaveBeenCalledWith('createAuthConfig:', 'Open authentication cannot be combined with any other authentication type');
        });

        it('should return default configuration when invalid JSON is provided', () => {
            process.env.ORD_AUTH = 'typo["Open"typo]';
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({ types: [AUTHENTICATION_TYPE.Open] });
            expect(Logger.error).toHaveBeenCalledWith('createAuthConfig:', expect.stringContaining('not valid JSON'));
        });

        it('should return default configuration when credentials are not valid JSON', () => {
            process.env.ORD_AUTH = `["${AUTHENTICATION_TYPE.Basic}"]`;
            process.env.APP_USER = 'non-valid-json';
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({ types: [AUTHENTICATION_TYPE.Open] });
            expect(Logger.error).toHaveBeenCalledWith('createAuthConfig:', expect.stringContaining('not valid JSON'));
        });

        it('should return auth configuration containing credentials by using data from process.env.APP_USER', () => {
            process.env.ORD_AUTH = `["${AUTHENTICATION_TYPE.Basic}"]`;
            process.env.APP_USER = JSON.stringify(mockValidUser);
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({
                types: [AUTHENTICATION_TYPE.Basic],
                credentials: {
                    username: "admin",
                    password: mockValidUser["admin"]
                }
            });
        });
        it('should return auth configuration containing credentials by using data from .cdsrc.json', () => {
            process.env.ORD_AUTH = `["${AUTHENTICATION_TYPE.Basic}"]`;
            cds.env.authentication.credentials = mockValidUser;
            const authConfig = createAuthConfig();
            expect(authConfig).toEqual({
                types: [AUTHENTICATION_TYPE.Basic],
                credentials: {
                    username: "admin",
                    password: mockValidUser["admin"]
                }
            });
        });

    });

    describe("Authentication middleware", () => {
        afterEach(() => {
            delete process.env.ORD_AUTH;
            delete process.env.APP_USER;
            cds.env.authentication = {}
            cds.context.authConfig = {};
        });

        it("should have access with default open authentication", async () => {
            authCheck({ headers: {} }, 200);
        });

        it("should not authenticate because of missing authorization header in case of any non-open authentication", async () => {
            cds.context.authConfig.types = [AUTHENTICATION_TYPE.Basic];
            const req = {
                headers: {}
            };

            authCheck(req, 401, "Authentication required.");
        });

        it("should not authenticate and set header 'WWW-Authenticate' because of missing authorization header", async () => {
            cds.context.authConfig.types = [AUTHENTICATION_TYPE.Basic];
            const req = {
                headers: {}
            };

            authCheck(req, 401, "Authentication required.", "401");
        });

        it("should not authenticate and should not set header 'WWW-Authenticate' because of missing authorization header", async () => {
            cds.context.authConfig.types = [AUTHENTICATION_TYPE.UclMtls];
            const req = {
                headers: {}
            };

            authCheck(req, 401, "Authentication required.");
        });

        it("should not authenticate because of invalid authentication type in the request header", async () => {
            cds.context.authConfig.types = [AUTHENTICATION_TYPE.Basic];
            const req = {
                headers: {
                    authorization: "Invalid " + Buffer.from(`invalid`).toString("base64")
                }
            };
            authCheck(req, 401, "Invalid authentication type");
        });

        it("should authenticate with valid credentials in the request", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
                credentials: {
                    username: "admin",
                    password: "secret"
                }
            };

            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from(`admin:${mockValidUser["admin"]}`).toString("base64")
                }
            };
            authCheck(req, 200);
        });

        it("should not authenticate because of invalid credentials in the request", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.Basic],
                credentials: {
                    username: "admin",
                    password: "secret"
                }
            };

            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from("invalid:invalid").toString("base64")
                }
            };
            authCheck(req, 401, "Invalid credentials");
        });

        it("should not authenticate for x-ssl-client-subject-dn header in the request", async () => {
            cds.context.authConfig = {
                types: [AUTHENTICATION_TYPE.Basic, AUTHENTICATION_TYPE.UclMtls],
            };

            const req = {
                headers: {
                    [CERT_SUBJECT_HEADER_KEY]: "Dummy Subject"
                }
            };
            authCheck(req, 401, "Not authorized");
        });
    });
});