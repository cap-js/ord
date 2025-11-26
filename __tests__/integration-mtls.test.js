const request = require("supertest");
const { spawn } = require("child_process");
const path = require("path");
const express = require("express");

const BASE_URL = "http://localhost:4004";
const ORD_CONFIG_ENDPOINT = "/.well-known/open-resource-discovery";
const ORD_DOCUMENT_ENDPOINT = "/ord/v1/documents/ord-document";

// Basic auth credential for fallback tests
const VALID_AUTH = "Basic YWRtaW46c2VjcmV0";

let serverProcess;

// Helper function to wait for server to be ready
async function waitForServer(maxAttempts = 30, delayMs = 2000) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await request(BASE_URL).get(ORD_CONFIG_ENDPOINT);
            console.log("Server is ready");
            return true;
        } catch {
            console.log(`Waiting for server... (attempt ${i + 1}/${maxAttempts})`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
    throw new Error("Server failed to start within timeout period");
}

describe("ORD Integration Tests - CF mTLS Authentication", () => {
    // ===== Mock Config Server Setup =====
    const MOCK_CONFIG_SERVER_PORT = 9999;
    const MOCK_CONFIG_ENDPOINT = `http://localhost:${MOCK_CONFIG_SERVER_PORT}/v1/info`;

    // Mock endpoint returns real certificate data (matching provider-server format)
    const MOCK_CERT_CONFIG_RESPONSE = {
        certIssuer: "CN=SAP PKI Certificate Service Client CA,OU=SAP BTP Clients,O=SAP SE,L=cf-us10-integrate,C=DE",
        certSubject:
            "CN=cmp-dev,OU=SAP Cloud Platform Clients,OU=Integrate,OU=cmp-cf-us10-integrate,O=SAP SE,L=Dev,C=DE",
        rootCA: "-----BEGIN CERTIFICATE-----\nMIIFZjCCA06gAwIBAgIQGHcPvmUGa79M6pM42bGFYjANBgkqhkiG9w0BAQsFADBN\nMQswCQYDVQQGEwJERTERMA8GA1UEBwwIV2FsbGRvcmYxDzANBgNVBAoMBlNBUCBT\nRTEaMBgGA1UEAwwRU0FQIENsb3VkIFJvb3QgQ0EwHhcNMTkwMjEzMTExOTM2WhcN\nMzkwMjEzMTEyNjMyWjBNMQswCQYDVQQGEwJERTERMA8GA1UEBwwIV2FsbGRvcmYx\nDzANBgNVBAoMBlNBUCBTRTEaMBgGA1UEAwwRU0FQIENsb3VkIFJvb3QgQ0EwggIi\nMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQChbHLXJoe/zFag6fB3IcN3d3HT\nY14nSkEZIuUzYs7B96GFxQi0T/2s971JFiLfB4KaCG+UcG3dLXf1H/wewq8ahArh\nFTsu4UR71ePUQiYlk/G68EFSy2zWYAJliXJS5k0DFMIWHD1lbSjCF3gPVJSUKf+v\nHmWD5e9vcuiPBlSCaEnSeimYRhg0ITmi3RJ4Wu7H0Xp7tDd5z4HUKuyi9XRinfvG\nkPALiBaX01QRC51cixmo0rhVe7qsNh7WDnLNBZeA0kkxNhLKDl8J6fQHKDdDEzmZ\nKhK5KxL5p5YIZWZ8eEdNRoYRMXR0PxmHvRanzRvSVlXSbfqxaKlORfJJ1ah1bRNt\no0ngAQchTghsrRuf3Qh/2Kn29IuBy4bjKR9CdNLxGrClvX/q26rUUlz6A3lbXbwJ\nEHSRnendRfEiia+xfZD+NG2oZW0IdTXSqkCbnBnign+uxGH5ECjuLEtvtUx6i9Ae\nxAvK2FqIuud+AchqiZBKzmQAhUjKUoACzNP2Bx2zgJOeB0BqGvf6aldG0n2hYxJF\n8Xssc8TBlwvAqtiubP/UxJJPs+IHqU+zjm7KdP6dM2sbE+J9O3n8DzOP0SDyEmWU\nUCwnmoPOQlq1z6fH9ghcp9bDdbh6adXM8I+SUYUcfvupOzBU7rWHxDCXld/24tpI\nFA7FRzHwKXqMSjwtBQIDAQABo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0TAQH/\nBAUwAwEB/zAdBgNVHQ4EFgQUHLxmKw7KjUufjZNxqQ/KZ0ZpEyIwDQYJKoZIhvcN\nAQELBQADggIBABdSKQsh3EfVoqplSIx6X43y2Pp+kHZLtEsRWMzgO5LhYy2/Fvel\neRBw/XEiB5iKuEGhxHz/Gqe0gZixw3SsHB1Q464EbGT4tPQ2UiMhiiDho9hVe6tX\nqX1FhrhycAD1xHIxMxQP/buX9s9arFZauZrpw/Jj4tGp7aEj4hypWpO9tzjdBthy\n5vXSviU8L2HyiQpVND/Rp+dNJmVYTiFLuULRY28QbikgFO2xp9s4RNkDBnbDeTrT\nCKWcVsmlZLPJJQZm0n2p8CvoeAsKzIULT9YSbEEBwmeqRlmbUaoT/rUGoobSFcrP\njrBg66y5hA2w7S3tDH0GjMpRu16b2u0hYQocUDuMlyhrkhsO+Qtqkz1ubwHCJ8PA\nRJw6zYl9VeBtgI5F69AEJdkAgYfvPw5DJipgVuQDSv7ezi6ZcI75939ENGjSyLVy\n4SuP99G7DuItG008T8AYFUHAM2h/yskVyvoZ8+gZx54TC9aY9gPIKyX++4bHv5BC\nqbEdU46N05R+AIBW2KvWozQkjhSQCbzcp6DHXLoZINI6y0WOImzXrvLUSIm4CBaj\n6MTXInIkmitdURnmpxTxLva5Kbng/u20u5ylIQKqpcD8HWX97lLVbmbnPkbpKxo+\nLvHPhNDM3rMsLu06agF4JTbO8ANYtWQTx0PVrZKJu+8fcIaUp7MVBIVZ\n-----END CERTIFICATE-----\n\n",
        ordAggregatorVersion: "1.10.0",
        openResourceDiscovery: {
            adoptedVersion: "1.10.0",
            validatorVersion: "5.2.1",
        },
    };

    // Alternative cert info for testing mismatches
    const DIFFERENT_ISSUER = "CN=Different CA,O=Other Org,C=US";
    const DIFFERENT_SUBJECT = "CN=different-service,O=Other Org,C=US";
    const UNTRUSTED_ROOT_CA = "CN=Untrusted Root CA,O=Untrusted Org,C=US";

    // Root CA DN extracted from the certificate
    const MOCK_ROOT_CA_DN = "CN=SAP Cloud Root CA,O=SAP SE,L=Walldorf,C=DE";

    let mockConfigServer;

    /**
     * Start the mock config server that serves /v1/info endpoint
     */
    function startMockConfigServer() {
        return new Promise((resolve) => {
            const app = express();
            app.use(express.json());

            app.get("/v1/info", (req, res) => {
                console.log("Mock /v1/info endpoint called");
                res.json(MOCK_CERT_CONFIG_RESPONSE);
            });

            mockConfigServer = app.listen(MOCK_CONFIG_SERVER_PORT, () => {
                console.log(`Mock config server started on http://localhost:${MOCK_CONFIG_SERVER_PORT}`);
                resolve();
            });
        });
    }

    /**
     * Stop the mock config server
     */
    function stopMockConfigServer() {
        return new Promise((resolve) => {
            if (mockConfigServer) {
                mockConfigServer.close(() => {
                    console.log("Mock config server stopped");
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Helper function to create base64-encoded mTLS headers
     * These headers simulate what CloudFoundry gorouter would provide
     */
    function createMtlsHeaders(issuer, subject, rootCaDn) {
        return {
            "x-forwarded-client-cert-issuer-dn": Buffer.from(issuer).toString("base64"),
            "x-forwarded-client-cert-subject-dn": Buffer.from(subject).toString("base64"),
            "x-forwarded-client-cert-root-ca-dn": Buffer.from(rootCaDn).toString("base64"),
        };
    }

    beforeAll(async () => {
        console.log("\n=== Starting mTLS Integration Test Setup ===");
        
        // Start mock config server first
        console.log("Step 1: Starting mock config server on port", MOCK_CONFIG_SERVER_PORT);
        await startMockConfigServer();
        console.log("✓ Mock config server ready at", MOCK_CONFIG_ENDPOINT);

        // Start CDS server with environment variable pointing to mock endpoint
        const appPath = path.join(__dirname, "integration-test-app");

        console.log("\nStep 2: Preparing CDS server with mTLS configuration");
        
        // Create CF_MTLS_TRUSTED_CERTS environment variable with configEndpoints
        const mtlsConfig = {
            certs: [],
            rootCaDn: ["CN=SAP Cloud Root CA,O=SAP SE,L=Walldorf,C=DE"],
            configEndpoints: [MOCK_CONFIG_ENDPOINT]
        };
        console.log("  - Config endpoints:", mtlsConfig.configEndpoints);
        console.log("  - Trusted root CA DNs:", mtlsConfig.rootCaDn.length);
        
        console.log("\nStep 3: Starting CDS server on port 4004...");
        serverProcess = spawn("npx", ["cds", "watch", "--port", "4004"], {
            cwd: appPath,
            env: {
                ...process.env,
                CF_MTLS_TRUSTED_CERTS: JSON.stringify(mtlsConfig),
            },
            stdio: ["ignore", "pipe", "pipe"],
        });

        // Log server output for debugging
        serverProcess.stdout.on("data", (data) => {
            const output = data.toString().trim();
            if (output) console.log(`  [CDS Server] ${output}`);
        });

        serverProcess.stderr.on("data", (data) => {
            const output = data.toString().trim();
            if (output) console.error(`  [CDS Error] ${output}`);
        });

        // Wait for server to be ready
        console.log("\nStep 4: Waiting for CDS server to be ready...");
        await waitForServer();
        console.log("✓ CDS server is ready and accepting requests");
        console.log("\n=== Test Setup Complete ===\n");
    }, 60000); // 60 second timeout for server startup

    afterAll(async () => {
        // Stop the CDS server
        if (serverProcess) {
            console.log("Stopping CDS server...");

            await new Promise((resolve) => {
                serverProcess.on("exit", () => {
                    console.log("Server stopped");
                    resolve();
                });

                // Try graceful shutdown first
                serverProcess.kill("SIGTERM");

                // Force kill after timeout
                setTimeout(() => {
                    if (!serverProcess.killed) {
                        serverProcess.kill("SIGKILL");
                    }
                }, 3000);
            });
        }

        // Stop the mock config server
        await stopMockConfigServer();
    });

    describe("mTLS Authentication - Valid Scenarios", () => {
        test("should accept valid mTLS headers for ORD document endpoint", async () => {
            console.log("\n[TEST] Testing valid mTLS headers for ORD document endpoint");
            const mtlsHeaders = createMtlsHeaders(
                MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                MOCK_CERT_CONFIG_RESPONSE.certSubject,
                MOCK_ROOT_CA_DN,
            );

            console.log("  - Sending request with valid mTLS certificate headers");
            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(200);

            console.log("  ✓ Request accepted (200 OK)");
            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(response.body).toHaveProperty("openResourceDiscovery", "1.12");
            console.log("  ✓ Response contains valid ORD document");
        });

        test("should accept valid mTLS headers for ORD config endpoint", async () => {
            console.log("\n[TEST] Testing valid mTLS headers for ORD config endpoint");
            const mtlsHeaders = createMtlsHeaders(
                MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                MOCK_CERT_CONFIG_RESPONSE.certSubject,
                MOCK_ROOT_CA_DN,
            );

            console.log("  - Sending request with valid mTLS certificate headers");
            const response = await request(BASE_URL).get(ORD_CONFIG_ENDPOINT).set(mtlsHeaders).expect(200);

            console.log("  ✓ Request accepted (200 OK)");
            expect(response.body).toHaveProperty("openResourceDiscoveryV1");
            console.log("  ✓ Response contains ORD configuration");
        });

        test("should accept mTLS headers with DN components in different order", async () => {
            console.log("\n[TEST] Testing DN order-insensitive matching");
            // DN tokenization should handle order-insensitive matching
            const reorderedIssuer =
                "C=DE,L=cf-us10-integrate,O=SAP SE,OU=SAP BTP Clients,CN=SAP PKI Certificate Service Client CA";
            const reorderedSubject =
                "C=DE,L=Dev,O=SAP SE,OU=cmp-cf-us10-integrate,OU=Integrate,OU=SAP Cloud Platform Clients,CN=cmp-dev";
            const reorderedRootCa = "C=DE,L=Walldorf,O=SAP SE,CN=SAP Cloud Root CA";

            console.log("  - Sending request with reordered DN components");
            const mtlsHeaders = createMtlsHeaders(reorderedIssuer, reorderedSubject, reorderedRootCa);

            await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(200);
            console.log("  ✓ Request accepted with reordered DNs (200 OK)");
        });
    });

    describe("mTLS Authentication - Invalid Certificate Scenarios", () => {
        test("should reject request with missing issuer header", async () => {
            const headers = {
                "x-forwarded-client-cert-subject-dn": Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certSubject).toString(
                    "base64",
                ),
                "x-forwarded-client-cert-root-ca-dn": Buffer.from(MOCK_ROOT_CA_DN).toString("base64"),
            };

            await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(headers).expect(401);
        });

        test("should reject request with missing subject header", async () => {
            const headers = {
                "x-forwarded-client-cert-issuer-dn": Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certIssuer).toString(
                    "base64",
                ),
                "x-forwarded-client-cert-root-ca-dn": Buffer.from(MOCK_ROOT_CA_DN).toString("base64"),
            };

            await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(headers).expect(401);
        });

        test("should reject request with missing root CA header", async () => {
            const headers = {
                "x-forwarded-client-cert-issuer-dn": Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certIssuer).toString(
                    "base64",
                ),
                "x-forwarded-client-cert-subject-dn": Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certSubject).toString(
                    "base64",
                ),
            };

            await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(headers).expect(401);
        });

        test("should reject certificate pair mismatch (valid issuer, wrong subject)", async () => {
            const mtlsHeaders = createMtlsHeaders(
                MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                DIFFERENT_SUBJECT,
                MOCK_ROOT_CA_DN,
            );

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(403);

            expect(response.text).toContain("Invalid client certificate");
        });

        test("should reject certificate pair mismatch (wrong issuer, valid subject)", async () => {
            const mtlsHeaders = createMtlsHeaders(
                DIFFERENT_ISSUER,
                MOCK_CERT_CONFIG_RESPONSE.certSubject,
                MOCK_ROOT_CA_DN,
            );

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(403);

            expect(response.text).toContain("Invalid client certificate");
        });

        test("should reject both issuer and subject mismatch", async () => {
            const mtlsHeaders = createMtlsHeaders(DIFFERENT_ISSUER, DIFFERENT_SUBJECT, MOCK_ROOT_CA_DN);

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(403);

            expect(response.text).toContain("Invalid client certificate");
        });

        test("should reject untrusted root CA", async () => {
            const mtlsHeaders = createMtlsHeaders(
                MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                MOCK_CERT_CONFIG_RESPONSE.certSubject,
                UNTRUSTED_ROOT_CA,
            );

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(403);

            expect(response.text).toContain("Untrusted certificate authority");
        });

        test("should reject invalid base64 encoding in issuer header", async () => {
            const headers = {
                "x-forwarded-client-cert-issuer-dn": "not-valid-base64!@#$%",
                "x-forwarded-client-cert-subject-dn": Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certSubject).toString(
                    "base64",
                ),
                "x-forwarded-client-cert-root-ca-dn": Buffer.from(MOCK_ROOT_CA_DN).toString("base64"),
            };

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(headers).expect(400);

            expect(response.text).toContain("Invalid certificate headers");
        });

        test("should reject invalid base64 encoding in subject header", async () => {
            const headers = {
                "x-forwarded-client-cert-issuer-dn": Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certIssuer).toString(
                    "base64",
                ),
                "x-forwarded-client-cert-subject-dn": "invalid@base64#",
                "x-forwarded-client-cert-root-ca-dn": Buffer.from(MOCK_ROOT_CA_DN).toString("base64"),
            };

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(headers).expect(400);

            expect(response.text).toContain("Invalid certificate headers");
        });

        test("should reject invalid base64 encoding in root CA header", async () => {
            const headers = {
                "x-forwarded-client-cert-issuer-dn": Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certIssuer).toString(
                    "base64",
                ),
                "x-forwarded-client-cert-subject-dn": Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certSubject).toString(
                    "base64",
                ),
                "x-forwarded-client-cert-root-ca-dn": "not-base64!!!",
            };

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(headers).expect(400);

            expect(response.text).toContain("Invalid certificate headers");
        });
    });

    describe("mTLS Authentication - Fallback to Basic Auth", () => {
        test("should fall back to Basic auth when mTLS headers are missing", async () => {
            const response = await request(BASE_URL)
                .get(ORD_DOCUMENT_ENDPOINT)
                .set("Authorization", VALID_AUTH)
                .expect(200);

            expect(response.body).toHaveProperty("openResourceDiscovery", "1.12");
        });

        test("should prioritize mTLS over Basic auth when both are provided", async () => {
            // Provide valid mTLS headers and invalid Basic auth
            const mtlsHeaders = createMtlsHeaders(
                MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                MOCK_CERT_CONFIG_RESPONSE.certSubject,
                MOCK_ROOT_CA_DN,
            );
            const invalidBasicAuth = "Basic aW52YWxpZDppbnZhbGlk"; // invalid:invalid

            const response = await request(BASE_URL)
                .get(ORD_DOCUMENT_ENDPOINT)
                .set(mtlsHeaders)
                .set("Authorization", invalidBasicAuth)
                .expect(200);

            expect(response.body).toHaveProperty("openResourceDiscovery", "1.12");
        });

        test("should not fall back to Basic auth when mTLS cert is invalid", async () => {
            // Provide invalid mTLS headers and valid Basic auth
            const invalidMtlsHeaders = createMtlsHeaders(DIFFERENT_ISSUER, DIFFERENT_SUBJECT, MOCK_ROOT_CA_DN);

            const response = await request(BASE_URL)
                .get(ORD_DOCUMENT_ENDPOINT)
                .set(invalidMtlsHeaders)
                .set("Authorization", VALID_AUTH)
                .expect(403);

            expect(response.text).toContain("Invalid client certificate");
        });
    });

    describe("ORD Document Structure with mTLS", () => {
        let ordDocument;

        beforeAll(async () => {
            const mtlsHeaders = createMtlsHeaders(
                MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                MOCK_CERT_CONFIG_RESPONSE.certSubject,
                MOCK_ROOT_CA_DN,
            );

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(200);

            ordDocument = response.body;
        });

        test("should have required ORD structure", () => {
            expect(ordDocument).toHaveProperty("openResourceDiscovery", "1.12");
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
