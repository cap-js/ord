const cds = require('@sap/cds');
const { AUTHENTICATION_TYPE } = require('../../lib/constants');
const { authenticate } = require('../../lib/authentication');
const { Logger } = require('../../lib/logger');

describe('Authentication Middleware', () => {
    const mockValidUser = { admin: "secret" };

    beforeAll(() => {
        cds.env.authentication = {
            credentials: {}
        };
        process.env.APP_USERS =
            cds.env.authentication.credentials = JSON.stringify(mockValidUser)
        Logger.log = Logger.error = jest.fn();
    });

    afterAll(() => {
        delete process.env.ORD_AUTH;
        delete process.env.APP_USERS;

        jest.restoreAllMocks();
    });

    function authCheck(req, status, message) {
        const res = {
            status: jest.fn().mockImplementation(value => { res.status = value; return res; }),
            setHeader: jest.fn(),
            end: jest.fn(),
            send: jest.fn().mockImplementation(message => { res.message = message; return res; })
        };
        const next = jest.fn();

        authenticate(req, res, next);

        // expecting the status to be ${status} and the message to be ${message}
        expect(res.status).toBe(status);
        expect(res.message).toBe(message);
    }

    describe("Open (No) Authentication", () => {
        afterEach(() => {
            delete process.env.ORD_AUTH;
            cds.env.authentication = {}
        });

        it("should have access without credentials - with default open authentication", async () => {
            authCheck({ headers: {} }, 200);
            expect(Logger.error).toHaveBeenCalledWith('getAuthenticationTypes:', expect.stringContaining('No authorization type is provided.'));
        });

        it("should set open authentication in case of invalid auth-configuration", async () => {
            process.env.ORD_AUTH = `typo["${AUTHENTICATION_TYPE.Open}"typo]`;

            authCheck({ headers: {} }, 200);
            expect(Logger.error).toHaveBeenCalledWith('getAuthenticationTypes:', expect.stringContaining('not valid JSON'));
        });

        it("should have access without credentials - with authentication set/read from process.env", async () => {
            process.env.ORD_AUTH = `["${AUTHENTICATION_TYPE.Open}"]`;

            authCheck({ headers: {} }, 200);
        });

        it("should have access without credentials - with authentication set/read from cds.env", async () => {
            cds.env.authentication.type = [AUTHENTICATION_TYPE.Open];

            authCheck({ headers: {} }, 200);
        });
    });

    describe("Basic Authentication", () => {
        beforeAll(() => {
            process.env.ORD_AUTH = `["${AUTHENTICATION_TYPE.Basic}"]`;
        });

        beforeEach(() => {
            process.env.APP_USERS = JSON.stringify(mockValidUser);
            cds.env.authentication.credentials = mockValidUser;
        });

        afterAll(() => {
            delete process.env.ORD_AUTH;
            delete process.env.APP_USERS;
            cds.env.authentication.credentials = {};
        });

        it("should authenticate with valid credentials; authentication set/read from process.env", async () => {
            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from(`admin:${mockValidUser["admin"]}`).toString("base64")
                }
            };

            authCheck(req, 200);
        });

        it("should authenticate with valid credentials; authentication set/read from cds.env", async () => {
            delete process.env.APP_USERS;

            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from(`admin:${mockValidUser["admin"]}`).toString("base64")
                }
            };

            authCheck(req, 200);
        });

        it("should reject if `process.env.APP_USERS` not being a valid JSON object", async () => {
            process.env.APP_USERS = "non-valid-json";
            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from(`admin:${mockValidUser["admin"]}`).toString("base64")
                }
            };

            authCheck(req, 401, "Invalid credentials");
            expect(Logger.error).toHaveBeenCalledWith('_getAuthConfiguration:', expect.stringContaining('not valid JSON'));
        });

        it("should reject if `cds.env.authentication.credentials` not being a valid JSON object", async () => {
            delete process.env.APP_USERS;
            cds.env.authentication.credentials = "non-valid-json";
            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from(`admin:${mockValidUser["admin"]}`).toString("base64")
                }
            };

            authCheck(req, 401, "Invalid credentials");
            expect(Logger.error).toHaveBeenCalledWith('_getAuthConfiguration:', expect.stringContaining('not valid JSON'));
        });

        it("should not authenticate because of invalid credentials", async () => {
            const req = {
                headers: {
                    authorization: "Basic " + Buffer.from("invalid:invalid").toString("base64")
                }
            };
            authCheck(req, 401, "Invalid credentials");
        });

        it("should not authenticate because of invalid authentication type", async () => {
            const req = {
                headers: {
                    authorization: "Invalid " + Buffer.from(`admin:${mockValidUser["admin"]}`).toString("base64")
                }
            };
            authCheck(req, 401, "Invalid authentication type");
        });

        it("should not authenticate because of missing authorization header", async () => {
            const req = {
                headers: {}
            };
            authCheck(req, 401, "Required header is missing");
        });
    });
});