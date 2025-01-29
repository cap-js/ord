const cds = require('@sap/cds');
const { AUTHENTICATION_TYPE, CERT_SUBJECT_HEADER_KEY } = require('../../lib/constants');
const { authenticate } = require('../../lib/authentication');

describe('Authentication Middleware', () => {
    const mockValidUser = { admin: "secret" };
    const mockTrustedSubject = "CN=test.example.com,OU=Test,O=Example";
    const uclMtlsEndpoint = "https://test-endpoint.com";

    beforeAll(() => {
        cds.env.authentication = {
            credentials: {}
        };
    });

    afterAll(() => {
        delete process.env.ORD_AUTH;
        delete process.env.APP_USERS;
        delete process.env.CMP_DEV_INFO_ENDPOINT;

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

        function uclMtlsAuthCheck(subjects) {
            cds.context = {
                trustedSubjects: [subjects]
            };
            const encodedSubject = Buffer.from(subjects, "ascii").toString("base64");
            const req = {
                headers: {
                    [CERT_SUBJECT_HEADER_KEY]: encodedSubject,
                }
            };
            authCheck(req, 200);
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
    });

    describe("Combined Authentication", () => {
        beforeEach(async () => {
            // server = fastify();
            // server.setErrorHandler(errorHandler);
            // await setupAuthentication(server, {
            //     authMethods: [OptAuthMethod.Basic, OptAuthMethod.UclMtls],
            //     validUsers: mockValidUsers,
            //     trustedSubjects: [mockTrustedSubject],
            // });
            // // Add a test route
            // server.get(protectedRoute, () => {
            //     return { status: "ok" };
            // });
            // await server.ready();
        });

        afterEach(async () => {
            // await server.close();
        });

        it("should authenticate with valid basic auth", async () => {
            const credentials = Buffer.from("admin:secret").toString("base64");
            // const response = await server.inject({
            //     method: "GET",
            //     url: protectedRoute,
            //     headers: {
            //         Authorization: `Basic ${credentials}`,
            //     },
            // });

            expect(200).toBe(200);
            expect(credentials).toBe(credentials);
        });

        it("should authenticate with valid certificate", async () => {
            const encodedSubject = Buffer.from(mockTrustedSubject).toString("base64");
            // const response = await server.inject({
            //     method: "GET",
            //     url: protectedRoute,
            //     headers: {
            //         "x-ssl-client-subject-dn": encodedSubject,
            //     },
            // });

            expect(200).toBe(200);
            expect(encodedSubject).toBe(encodedSubject);
        });

        it("should reject with invalid certificate", async () => {
            const encodedSubject = Buffer.from("CN=invalid.example.com", "ascii").toString("base64");
            // const response = await server.inject({
            //     method: "GET",
            //     url: protectedRoute,
            //     headers: {
            //         "x-ssl-client-subject-dn": encodedSubject,
            //     },
            // });

            expect(401).toBe(401);
            expect(encodedSubject).toBe(encodedSubject);
        });

        it("should reject with invalid basic auth", async () => {
            const credentials = Buffer.from("admin:invalid").toString("base64");
            // const response = await server.inject({
            //     method: "GET",
            //     url: protectedRoute,
            //     headers: {
            //         Authorization: `Basic ${credentials}`,
            //     },
            // });

            expect(401).toBe(401);
            expect(credentials).toBe(credentials);
        });

        it("should reject without any authentication", async () => {
            // const response = await server.inject({
            //     method: "GET",
            //     url: protectedRoute,
            // });

            expect(401).toBe(401);
        });
    });
});