process.env.CDS_CONFIG = ".cdsrc.basic.json";

const cds = require("@sap/cds");
const path = require("path");

const utils = require("../utils");
const { ORD_ACCESS_STRATEGY } = require("../../lib/constants");

const TEST = cds.test(path.join(__dirname, "integration-test-app"));

const ORD_CONFIG_ENDPOINT = "/.well-known/open-resource-discovery";
const ORD_DOCUMENT_ENDPOINT = "/ord/v1/documents/ord-document";

// Basic auth credentials from ord-endpoint.http: admin:secret
const VALID_AUTH = "Basic YWRtaW46c2VjcmV0";
const BEARER_TOKEN = "Bearer some-token-value";
const MALFORMED_AUTH = "BasicYWRtaW46c2VjcmV0"; // Missing space
const INVALID_USER_AUTH = "Basic d3JvbmdfdXNlcjpzZWNyZXQ="; // wronguser:secret
const INVALID_PASS_AUTH = "Basic YWRtaW46d3JvbmdwYXNzd29yZA=="; // admin:wrongpassword

describe("ORD Integration Tests - Basic Authentication", () => {
    describe("ORD Config Endpoint Tests", () => {
        test("should return ORD config with valid basic auth (lowercase header)", async () => {
            const response = await TEST.get(ORD_CONFIG_ENDPOINT, { headers: { Authorization: VALID_AUTH } });

            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(response.data).toEqual({
                openResourceDiscoveryV1: {
                    documents: [
                        {
                            url: "/ord/v1/documents/ord-document?part=0",
                            accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Basic }],
                            perspective: "system-version",
                        },
                    ],
                },
            });
        });

        test("should return ORD config with standard Authorization header", async () => {
            const response = await TEST.get(ORD_CONFIG_ENDPOINT, { headers: { Authorization: VALID_AUTH } });

            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(response.data).toMatchSnapshot();
        });

        test("should return ORD config without authentication", async () => {
            const response = await TEST.get(ORD_CONFIG_ENDPOINT);

            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(response.data).toMatchSnapshot();
        });
    });

    describe("ORD Document Endpoint Tests", () => {
        test("should return ORD document with valid basic auth (lowercase header)", async () => {
            const response = await TEST.get(ORD_DOCUMENT_ENDPOINT, { headers: { Authorization: VALID_AUTH } });

            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(utils.pinLastUpdateForStableTest(response.data)).toMatchSnapshot();
        });

        test("should return ORD document with standard Authorization header", async () => {
            const response = await TEST.get(ORD_DOCUMENT_ENDPOINT, { headers: { Authorization: VALID_AUTH } });

            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(utils.pinLastUpdateForStableTest(response.data)).toMatchSnapshot();
        });

        test("should reject invalid password", async () => {
            const response = await TEST.get(ORD_DOCUMENT_ENDPOINT, {
                validateStatus: () => true,
                headers: { Authorization: INVALID_PASS_AUTH },
            });

            expect(response.status).toBe(401);
            expect(response.data).toBe("Invalid credentials");
        });

        test("should reject invalid username", async () => {
            const response = await TEST.get(ORD_DOCUMENT_ENDPOINT, {
                validateStatus: () => true,
                headers: { Authorization: INVALID_USER_AUTH },
            });

            expect(response.status).toBe(401);
            expect(response.data).toBe("Invalid credentials");
        });

        test("should require authentication when missing credentials", async () => {
            const response = await TEST.get(ORD_DOCUMENT_ENDPOINT, { validateStatus: () => true });

            expect(response.status).toBe(401);
            expect(response.headers["www-authenticate"]).toBeDefined();
            expect(response.data).toContain("Authentication required");
        });

        test("should reject Bearer token", async () => {
            const response = await TEST.get(ORD_DOCUMENT_ENDPOINT, {
                validateStatus: () => true,
                headers: { Authorization: BEARER_TOKEN },
            });

            expect(response.status).toBe(401);
            expect(response.data).toContain("Invalid authentication type");
        });

        test("should reject malformed Authorization header", async () => {
            const response = await TEST.get(ORD_DOCUMENT_ENDPOINT, {
                validateStatus: () => true,
                headers: { Authorization: MALFORMED_AUTH },
            });

            expect(response.status).toBe(401);
        });

        test("should reject empty Authorization header", async () => {
            const response = await TEST.get(ORD_DOCUMENT_ENDPOINT, {
                validateStatus: () => true,
                headers: { Authorization: "" },
            });

            expect(response.status).toBe(401);
            expect(response.data).toContain("Authentication required");
        });

        test("should return bad request when requesting document with invalid perspective", async () => {
            const response = await TEST.get(ORD_DOCUMENT_ENDPOINT + "?perspective=invalid", {
                validateStatus: () => true,
                headers: { Authorization: VALID_AUTH },
            });

            expect(response.status).toBe(400);
        });

        test("should return bad request when requesting document with system-instance perspective and no tenant", async () => {
            const response = await TEST.get(ORD_DOCUMENT_ENDPOINT + "?perspective=system-instance", {
                validateStatus: () => true,
                headers: { Authorization: VALID_AUTH },
            });

            expect(response.status).toBe(400);
        });

        test("should return ORD document with valid basic auth for system-version perspective", async () => {
            const response = await TEST.get(ORD_DOCUMENT_ENDPOINT + "?perspective=system-version", {
                headers: { Authorization: VALID_AUTH },
            });

            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(utils.pinLastUpdateForStableTest(response.data)).toMatchSnapshot();
        });

        test("should return ORD document with valid basic auth for system-instance perspective", async () => {
            const response = await TEST.get(ORD_DOCUMENT_ENDPOINT + "?perspective=system-instance", {
                headers: {
                    "Authorization": VALID_AUTH,
                    "Local-Tenant-Id": "12-34-56",
                },
            });

            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(utils.pinLastUpdateForStableTest(response.data)).toMatchSnapshot();
        });
    });

    describe("ORD Document Structure Validation for system-version perspective", () => {
        let ordDocument;

        beforeAll(async () => {
            const response = await TEST.get(ORD_DOCUMENT_ENDPOINT, { headers: { Authorization: VALID_AUTH } });

            ordDocument = utils.pinLastUpdateForStableTest(response.data);
        });

        test("should have required ORD structure", () => {
            expect(ordDocument).toHaveProperty("openResourceDiscovery", "1.14");
            expect(ordDocument).toHaveProperty("description");
            expect(Array.isArray(ordDocument.apiResources)).toBe(true);
            expect(Array.isArray(ordDocument.eventResources)).toBe(true);
            expect(ordDocument.perspective).toBe("system-version");
            expect(ordDocument.describedSystemVersion).toEqual({ version: "0.1.0" });
        });

        test("should include TestService with correct properties", () => {
            const testService = ordDocument.apiResources.find(
                (api) => api.title === "Test Service for Integration Testing",
            );

            expect(testService).toMatchSnapshot();
        });

        test("should contain expected resources", () => {
            expect(ordDocument.apiResources).toHaveLength(3);
            expect(ordDocument.eventResources).toHaveLength(1);
            expect(ordDocument.packages).toHaveLength(1);
        });

        test("should have correct query params for all resource definitions", () => {
            ordDocument.apiResources.forEach((apiResource) => {
                apiResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.url).toMatch(/(.*)\.(edmx|oas3\.json)$/);
                });
            });

            ordDocument.eventResources.forEach((eventResource) => {
                eventResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.url).toMatch(/(.*)\.asyncapi2\.json$/);
                });
            });
        });

        test("should have 'basic-auth' accessStrategies in all resources", () => {
            // Verify API resources have 'basic-auth' accessStrategies
            ordDocument.apiResources.forEach((apiResource) => {
                apiResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.accessStrategies).toEqual(
                        expect.arrayContaining([{ type: ORD_ACCESS_STRATEGY.Basic }]),
                    );
                    expect(resDef.accessStrategies.some((s) => s.type === ORD_ACCESS_STRATEGY.Basic)).toBe(true);
                });
            });

            // Verify Event resources have 'basic-auth' accessStrategies
            ordDocument.eventResources.forEach((eventResource) => {
                eventResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.accessStrategies).toEqual(
                        expect.arrayContaining([{ type: ORD_ACCESS_STRATEGY.Basic }]),
                    );
                    expect(resDef.accessStrategies.some((s) => s.type === ORD_ACCESS_STRATEGY.Basic)).toBe(true);
                });
            });

            // Verify no resource has 'open' accessStrategy
            [...ordDocument.apiResources, ...ordDocument.eventResources].forEach((resource) => {
                resource.resourceDefinitions.forEach((resDef) => {
                    const hasOpen = resDef.accessStrategies.some((s) => s.type === ORD_ACCESS_STRATEGY.Open);
                    expect(hasOpen).toBe(false);
                });
            });
        });
    });

    describe("ORD Document Structure Validation for system-instance perspective", () => {
        let ordDocument;

        beforeAll(async () => {
            const response = await TEST.get("/ord/v1/documents/ord-document?perspective=system-instance", {
                headers: { "Authorization": VALID_AUTH, "Local-Tenant-Id": "12-34-56" },
            });

            ordDocument = utils.pinLastUpdateForStableTest(response.data);
        });

        test("should have required ORD structure", () => {
            expect(ordDocument).toHaveProperty("openResourceDiscovery", "1.14");
            expect(ordDocument).toHaveProperty("description");
            expect(Array.isArray(ordDocument.apiResources)).toBe(true);
            expect(Array.isArray(ordDocument.eventResources)).toBe(true);
            expect(ordDocument.perspective).toBe("system-instance");
            expect(ordDocument.describedSystemVersion).toEqual(undefined);
        });

        test("should include TestService with correct properties", () => {
            const testService = ordDocument.apiResources.find(
                (api) => api.title === "Test Service for Integration Testing",
            );

            expect(testService).toMatchSnapshot();
        });

        test("should contain expected resources", () => {
            expect(ordDocument.apiResources).toHaveLength(3);
            expect(ordDocument.eventResources).toHaveLength(1);
            expect(ordDocument.packages).toHaveLength(1);
        });

        test("should have correct query params for all resource definitions", () => {
            ordDocument.apiResources.forEach((apiResource) => {
                apiResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.url).toMatch(/(.*)\?perspective=system-instance$/);
                });
            });

            ordDocument.eventResources.forEach((eventResource) => {
                eventResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.url).toMatch(/(.*)\?perspective=system-instance$/);
                });
            });
        });

        test("should have 'basic-auth' accessStrategies in all resources", () => {
            // Verify API resources have 'basic-auth' accessStrategies
            ordDocument.apiResources.forEach((apiResource) => {
                apiResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.accessStrategies).toEqual(
                        expect.arrayContaining([{ type: ORD_ACCESS_STRATEGY.Basic }]),
                    );
                    expect(resDef.accessStrategies.some((s) => s.type === ORD_ACCESS_STRATEGY.Basic)).toBe(true);
                });
            });

            // Verify Event resources have 'basic-auth' accessStrategies
            ordDocument.eventResources.forEach((eventResource) => {
                eventResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.accessStrategies).toEqual(
                        expect.arrayContaining([{ type: ORD_ACCESS_STRATEGY.Basic }]),
                    );
                    expect(resDef.accessStrategies.some((s) => s.type === ORD_ACCESS_STRATEGY.Basic)).toBe(true);
                });
            });

            // Verify no resource has 'open' accessStrategy
            [...ordDocument.apiResources, ...ordDocument.eventResources].forEach((resource) => {
                resource.resourceDefinitions.forEach((resDef) => {
                    const hasOpen = resDef.accessStrategies.some((s) => s.type === ORD_ACCESS_STRATEGY.Open);
                    expect(hasOpen).toBe(false);
                });
            });
        });
    });
});
