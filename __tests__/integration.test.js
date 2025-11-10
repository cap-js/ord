const request = require("supertest");

const BASE_URL = "http://localhost:4004";
const ORD_CONFIG_ENDPOINT = "/.well-known/open-resource-discovery";
const ORD_DOCUMENT_ENDPOINT = "/ord/v1/documents/ord-document";

// Basic auth credentials from ord-endpoint.http: admin:secret
const VALID_AUTH = "Basic YWRtaW46c2VjcmV0";
const INVALID_USER_AUTH = "Basic d3JvbmdfdXNlcjpzZWNyZXQ="; // wronguser:secret
const INVALID_PASS_AUTH = "Basic YWRtaW46d3JvbmdwYXNzd29yZA=="; // admin:wrongpassword
const BEARER_TOKEN = "Bearer some-token-value";
const MALFORMED_AUTH = "BasicYWRtaW46c2VjcmV0"; // Missing space

describe("ORD Integration Tests - Basic Authentication", () => {
    describe("ORD Config Endpoint Tests", () => {
        test("should return ORD config with valid basic auth (lowercase header)", async () => {
            const response = await request(BASE_URL)
                .get(ORD_CONFIG_ENDPOINT)
                .set("authorization", VALID_AUTH) // lowercase as in HTTP file
                .expect(200);

            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(response.body).toHaveProperty("openResourceDiscoveryV1");
        });

        test("should return ORD config with standard Authorization header", async () => {
            const response = await request(BASE_URL)
                .get(ORD_CONFIG_ENDPOINT)
                .set("Authorization", VALID_AUTH) // standard case
                .expect(200);

            expect(response.body).toHaveProperty("openResourceDiscoveryV1");
        });

        test("should return ORD config without authentication", async () => {
            const response = await request(BASE_URL)
                .get(ORD_CONFIG_ENDPOINT)
                .expect(200);

            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(response.body).toHaveProperty("openResourceDiscoveryV1");
        });
    });

    describe("ORD Document Endpoint Tests", () => {
        test("should return ORD document with valid basic auth (lowercase header)", async () => {
            const response = await request(BASE_URL)
                .get(ORD_DOCUMENT_ENDPOINT)
                .set("authorization", VALID_AUTH) // lowercase
                .expect(200);

            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(response.body).toHaveProperty("openResourceDiscovery", "1.9");
        });

        test("should return ORD document with standard Authorization header", async () => {
            const response = await request(BASE_URL)
                .get(ORD_DOCUMENT_ENDPOINT)
                .set("Authorization", VALID_AUTH) // standard case
                .expect(200);

            expect(response.body).toHaveProperty("openResourceDiscovery", "1.9");
        });

        test("should reject invalid password", async () => {
            const response = await request(BASE_URL)
                .get(ORD_DOCUMENT_ENDPOINT)
                .set("Authorization", INVALID_PASS_AUTH)
                .expect(401);

            expect(response.text).toContain("Invalid credentials");
        });

        test("should reject invalid username", async () => {
            const response = await request(BASE_URL)
                .get(ORD_DOCUMENT_ENDPOINT)
                .set("Authorization", INVALID_USER_AUTH)
                .expect(401);

            expect(response.text).toContain("Invalid credentials");
        });

        test("should require authentication when missing credentials", async () => {
            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).expect(401);

            expect(response.text).toContain("Authentication required");
            expect(response.headers["www-authenticate"]).toBeDefined();
        });

        test("should reject Bearer token", async () => {
            const response = await request(BASE_URL)
                .get(ORD_DOCUMENT_ENDPOINT)
                .set("Authorization", BEARER_TOKEN)
                .expect(401);

            expect(response.text).toContain("Invalid authentication type");
        });

        test("should reject malformed Authorization header", async () => {
            await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set("Authorization", MALFORMED_AUTH).expect(401);
        });

        test("should reject empty Authorization header", async () => {
            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set("Authorization", "").expect(401);

            expect(response.text).toContain("Not authorized");
        });
    });

    describe("ORD Document Structure Validation", () => {
        let ordDocument;

        beforeAll(async () => {
            const response = await request(BASE_URL)
                .get(ORD_DOCUMENT_ENDPOINT)
                .set("Authorization", VALID_AUTH)
                .expect(200);

            ordDocument = response.body;
        });

        test("should have required ORD structure", () => {
            expect(ordDocument).toHaveProperty("openResourceDiscovery", "1.9");
            expect(ordDocument).toHaveProperty("description");
            expect(Array.isArray(ordDocument.apiResources)).toBe(true);
            expect(Array.isArray(ordDocument.eventResources)).toBe(true);
        });

        test("should include TestService with correct properties", () => {
            const testService = ordDocument.apiResources.find(
                (api) => api.title === "Test Service for Integration Testing",
            );
            expect(testService).toMatchObject({
                shortDescription: "Minimal service for ORD integration tests",
                version: "1.0.0",
                visibility: "public",
            });
        });

        test("should contain expected resources", () => {
            expect(ordDocument.apiResources).toHaveLength(1);
            expect(ordDocument.eventResources).toHaveLength(1);
            expect(ordDocument.packages).toHaveLength(1);
        });
    });
});
