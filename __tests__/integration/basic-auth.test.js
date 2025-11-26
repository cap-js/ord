const request = require("supertest");
const { spawn } = require("child_process");
const path = require("path");

const BASE_URL = "http://localhost:4004";
const ORD_CONFIG_ENDPOINT = "/.well-known/open-resource-discovery";
const ORD_DOCUMENT_ENDPOINT = "/ord/v1/documents/ord-document";

// Basic auth credentials from ord-endpoint.http: admin:secret
const VALID_AUTH = "Basic YWRtaW46c2VjcmV0";
const INVALID_USER_AUTH = "Basic d3JvbmdfdXNlcjpzZWNyZXQ="; // wronguser:secret
const INVALID_PASS_AUTH = "Basic YWRtaW46d3JvbmdwYXNzd29yZA=="; // admin:wrongpassword
const BEARER_TOKEN = "Bearer some-token-value";
const MALFORMED_AUTH = "BasicYWRtaW46c2VjcmV0"; // Missing space

let serverProcess;

/**
 * Wait for CDS server to be ready
 * Only checks if we can connect, doesn't validate status codes
 */
async function waitForServer(maxAttempts = 30, delayMs = 500) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            // Test config endpoint (should be accessible)
            await request(BASE_URL).get(ORD_CONFIG_ENDPOINT);

            // Test document endpoint with auth (should require auth)
            await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set("Authorization", VALID_AUTH);

            console.log("CDS server ready");
            return true;
        } catch {
            if (i < maxAttempts - 1) {
                console.log(`Waiting for CDS server (attempt ${i + 1}/${maxAttempts})`);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }
    throw new Error("Server failed to start within timeout period");
}

describe("ORD Integration Tests - Basic Authentication", () => {
    beforeAll(async () => {
        console.log("Starting basic-auth integration test setup");

        const testAppRoot = path.join(__dirname, "integration-test-app");

        console.log(`Test app root: ${testAppRoot}`);

        // Start CDS server with Basic Authentication (uses .cdsrc.json config)
        serverProcess = spawn("npx", ["cds", "run"], {
            cwd: testAppRoot,
            env: {
                ...process.env,
                // Basic auth is configured via .cdsrc.json (cds.ord.authentication.basic)
            },
            stdio: ["ignore", "pipe", "pipe"],
        });

        serverProcess.stdout.on("data", (data) => {
            const out = data.toString().trim();
            if (out) console.log(`[CDS] ${out}`);
        });

        serverProcess.stderr.on("data", (data) => {
            const out = data.toString().trim();
            if (out) {
                console.error(`[CDS ERR] ${out}`);
                // Detect fatal errors
                if (out.includes("Error:") || out.includes("EADDRINUSE") || out.includes("EACCES")) {
                    console.error("Fatal error detected during server startup");
                }
            }
        });

        serverProcess.on("exit", (code, signal) => {
            if (code !== null && code !== 0) {
                console.error(`CDS process exited with code ${code}`);
            }
            if (signal) {
                console.error(`CDS process killed with signal ${signal}`);
            }
        });

        await waitForServer();
        console.log("Basic-auth test setup complete");
    }, 60000); // 60 second timeout for server startup

    afterAll(async () => {
        // Stop the server
        if (serverProcess && !serverProcess.killed) {
            console.log("Stopping CDS server");

            return new Promise((resolve) => {
                const cleanup = () => {
                    console.log("CDS server stopped");
                    serverProcess = null;
                    resolve();
                };

                serverProcess.on("exit", cleanup);

                // Try graceful shutdown first
                serverProcess.kill("SIGTERM");

                // Force kill after timeout
                setTimeout(() => {
                    if (serverProcess && !serverProcess.killed) {
                        console.log("Force killing CDS server");
                        serverProcess.kill("SIGKILL");
                        setTimeout(cleanup, 500);
                    }
                }, 3000);
            });
        }
    }, 10000); // 10 second timeout for cleanup

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
            const response = await request(BASE_URL).get(ORD_CONFIG_ENDPOINT).expect(200);

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
            expect(response.body).toHaveProperty("openResourceDiscovery", "1.12");
        });

        test("should return ORD document with standard Authorization header", async () => {
            const response = await request(BASE_URL)
                .get(ORD_DOCUMENT_ENDPOINT)
                .set("Authorization", VALID_AUTH) // standard case
                .expect(200);

            expect(response.body).toHaveProperty("openResourceDiscovery", "1.12");
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

            expect(response.text).toContain("Authentication required");
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

        test("should have 'basic-auth' accessStrategies in all resources", () => {
            // Verify API resources have 'basic-auth' accessStrategies
            ordDocument.apiResources.forEach((apiResource) => {
                apiResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.accessStrategies).toEqual(expect.arrayContaining([{ type: "basic-auth" }]));
                    expect(resDef.accessStrategies.some((s) => s.type === "basic-auth")).toBe(true);
                });
            });

            // Verify Event resources have 'basic-auth' accessStrategies
            ordDocument.eventResources.forEach((eventResource) => {
                eventResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.accessStrategies).toEqual(expect.arrayContaining([{ type: "basic-auth" }]));
                    expect(resDef.accessStrategies.some((s) => s.type === "basic-auth")).toBe(true);
                });
            });

            // Verify no resource has 'open' accessStrategy
            [...ordDocument.apiResources, ...ordDocument.eventResources].forEach((resource) => {
                resource.resourceDefinitions.forEach((resDef) => {
                    const hasOpen = resDef.accessStrategies.some((s) => s.type === "open");
                    expect(hasOpen).toBe(false);
                });
            });
        });
    });
});
