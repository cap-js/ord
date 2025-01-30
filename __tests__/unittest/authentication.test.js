const cds = require('@sap/cds');
const { AUTHENTICATION_TYPE, CERT_SUBJECT_HEADER_KEY } = require('../../lib/constants');
const { authenticate, getTrustedSubjects } = require('../../lib/authentication');
const { Logger } = require('../../lib/logger');

describe('Authentication Middleware', () => {
    const mockValidUser = { admin: "secret" };
    const mockTrustedSubject = "CN=test.example.com,OU=Test,O=Example";
    const mockUntrustedSubject = "CN=invalid.example.com";
    const uclMtlsEndpoint = "https://test-endpoint.com";

    beforeAll(() => {
        cds.env.authentication = {
            credentials: {}
        };
        process.env.ORD_AUTH =
            cds.env.authentication.type = AUTHENTICATION_TYPE.UclMtls;
        process.env.APP_USERS =
            cds.env.authentication.credentials = JSON.stringify(mockValidUser)
        process.env.UCL_MTLS_ENDPOINTS =
            cds.env.authentication.uclMtlsEndpoints = `["${uclMtlsEndpoint}"]`
        Logger.log = Logger.error = jest.fn();
    });

    afterAll(() => {
        delete process.env.ORD_AUTH;
        delete process.env.APP_USERS;
        delete process.env.UCL_MTLS_ENDPOINTS;

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

    it('should return certSubject from the endpoint', async () => {
        // mock the fetch function implementation
        global.fetch = jest.fn().mockResolvedValue({ json: jest.fn().mockResolvedValue({ certSubject: mockTrustedSubject }) });
        const result = await getTrustedSubjects(uclMtlsEndpoint);
        expect(result).toEqual([mockTrustedSubject]);
        expect(Logger.log).toHaveBeenCalledWith('TrustedSubjectService:', uclMtlsEndpoint);
    });

    it('should return null from invalid endpoint', async () => {
        // mock the fetch function implementation
        global.fetch = jest.fn().mockRejectedValue({ message: "Error" });
        const result = await getTrustedSubjects(uclMtlsEndpoint);
        expect(result).toEqual([]);
        expect(Logger.error).toHaveBeenCalledWith('TrustedSubjectService:', 'Error');
    });

    describe("Open (No) Authentication", () => {
        beforeAll(() => {
            cds.env.authentication = {
                type: AUTHENTICATION_TYPE.Open
            };
        });

        beforeEach(() => {
            delete process.env.ORD_AUTH;
        });

        it("should have access without credentials - with authentication set/read from process.env", async () => {
            process.env.ORD_AUTH = AUTHENTICATION_TYPE.Open;

            authCheck({ headers: {} }, 200);
        });

        it("should have access without credentials - with authentication set/read from cds.env", async () => {
            cds.env.authentication.type = AUTHENTICATION_TYPE.Open;

            authCheck({ headers: {} }, 200);
        });

        it("should have access without credentials - with default open authentication", async () => {
            authCheck({ headers: {} }, 200);
        });
    });

    describe("Basic Authentication", () => {
        beforeAll(() => {
            process.env.ORD_AUTH = AUTHENTICATION_TYPE.Basic;
        });

        beforeEach(() => {
            process.env.APP_USERS =
                cds.env.authentication.credentials = JSON.stringify(mockValidUser);
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

        it("should not apply basic authentication because of `process.env.APP_USERS` not being a valid JSON object", async () => {
            process.env.APP_USERS = "non-valid-json";
            Logger.error = jest.fn();
            authCheck({}, 200);
            expect(Logger.error).toHaveBeenCalledWith('getAuthConfiguration:', expect.stringContaining('Unexpected token'));
        });

        it("should not apply basic authentication because of `cds.env.authentication.credentials` not being a valid JSON object", async () => {
            delete process.env.APP_USERS;
            Logger.error = jest.fn();
            cds.env.authentication.credentials = "non-valid-json";
            authCheck({}, 200);
            expect(Logger.error).toHaveBeenCalledWith('getAuthConfiguration:', expect.stringContaining('Unexpected token'));
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

        it("should not authenticate because of missing authorization header missing", async () => {
            const req = {
                headers: {}
            };
            authCheck(req, 401, "Authorization header missing");
        });
    });

    describe("UCL mTLS Authentication", () => {

        function uclMtlsAuthCheck(subjects, message, status = 200) {
            cds.context = {
                trustedSubjects: [mockTrustedSubject]
            };
            const encodedSubject = Buffer.from(subjects, "ascii").toString("base64");
            const req = {
                headers: {
                    [CERT_SUBJECT_HEADER_KEY]: encodedSubject,
                }
            };
            authCheck(req, status, message);
        }

        beforeEach(() => {
            process.env.ORD_AUTH =
                cds.env.authentication.type = AUTHENTICATION_TYPE.UclMtls;
            process.env.UCL_MTLS_ENDPOINTS =
                cds.env.authentication.uclMtlsEndpoints = `["${uclMtlsEndpoint}"]`
        });


        afterAll(() => {
            delete process.env.ORD_AUTH,
                process.env.UCL_MTLS_ENDPOINTS,
                cds.context,
                cds.env.authentication.uclMtlsEndpoints;
        });

        it("should authenticate with valid certificate subject; authentication set/read from process.env", async () => {
            uclMtlsAuthCheck(mockTrustedSubject);
        });

        it("should authenticate with valid certificate subject; authentication set/read from cds.env", async () => {
            delete process.env.ORD_AUTH;
            delete process.env.UCL_MTLS_ENDPOINTS;

            uclMtlsAuthCheck(mockTrustedSubject);
        });

        it("should not apply ucl-mtls authentication because of `process.env.UCL_MTLS_ENDPOINTS` not being a valid JSON object", async () => {
            process.env.UCL_MTLS_ENDPOINTS = "non-valid-json";
            Logger.error = jest.fn();
            authCheck({}, 200);
            expect(Logger.error).toHaveBeenCalledWith('getAuthConfiguration:', expect.stringContaining('Unexpected token'));
        });

        it("should not apply ucl-mtls authentication because of `cds.env.authentication.uclMtlsEndpoints` not being a valid JSON object", async () => {
            delete process.env.UCL_MTLS_ENDPOINTS;
            cds.env.authentication.uclMtlsEndpoints = "non-valid-json";
            Logger.error = jest.fn();
            authCheck({}, 200);
            expect(Logger.error).toHaveBeenCalledWith('getAuthConfiguration:', expect.stringContaining('Unexpected token'));
        });

        it("should NOT authenticate because of missing certificate subject header", async () => {
            uclMtlsAuthCheck("", "Certificate subject header is missing", 401);
        });

        it("should NOT authenticate because of invalid certificate subject header", async () => {
            uclMtlsAuthCheck(mockUntrustedSubject, "Certificate subject header is invalid", 401);
        });
    });
});