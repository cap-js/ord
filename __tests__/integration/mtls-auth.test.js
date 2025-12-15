/**
 * ============================================================================
 * mTLS Integration Tests - SEQUENTIAL EXECUTION REQUIRED
 * ============================================================================
 *
 * These tests MUST run sequentially (not in parallel) because:
 * 1. CDS servers occupy fixed ports (4005, 4006)
 * 2. Mock config servers occupy fixed ports (9999)
 * 3. Environment variables (CF_MTLS_TRUSTED_CERTS) affect global state
 * 4. Temporary config files are created/deleted during tests
 *
 * Run with: npm run test:integration:mtls
 * The GitHub Actions workflow ensures sequential execution across test files.
 *
 * Test Suite 1: Environment Variable Priority (port 4005)
 *   - Proves CF_MTLS_TRUSTED_CERTS overrides config file settings
 *   - Uses dynamically created temporary wrong config file
 *   - No mock server needed (env var provides cert info directly)
 *
 * Test Suite 2: Config Endpoint Fetch (port 4006, mock 9999)
 *   - Tests fetchMtlsCertInfo endpoint fetching from .cdsrc.mtls.json
 *   - Uses existing .cdsrc.mtls.json configuration
 *   - No CF_MTLS_TRUSTED_CERTS env var (forces config endpoint fetch)
 *
 * Cleanup order (CRITICAL):
 *   1. Stop CDS server
 *   2. Stop mock config server (if used)
 *   3. Remove temporary config files (if created)
 * ============================================================================
 */

const request = require("supertest");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const net = require("net");
const fs = require("fs");

const ORD_CONFIG_ENDPOINT = "/.well-known/open-resource-discovery";
const ORD_DOCUMENT_ENDPOINT = "/ord/v1/documents/ord-document";

/**
 * Check if a port is available for binding
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} - True if port is available
 */
async function isPortAvailable(port) {
    return new Promise((resolve) => {
        const tester = net
            .createServer()
            .once("error", () => resolve(false))
            .once("listening", () => tester.once("close", () => resolve(true)).close())
            .listen(port);
    });
}

/**
 * Wait for CDS server to be ready
 * @param {string} baseUrl - Base URL of the server (e.g., "http://localhost:4005")
 * @param {number} maxAttempts - Maximum number of connection attempts
 * @param {number} delayMs - Delay between attempts in milliseconds
 */
async function waitForServer(baseUrl, maxAttempts = 30, delayMs = 500) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await request(baseUrl).get(ORD_CONFIG_ENDPOINT);
            console.log(`CDS server at ${baseUrl} is ready`);
            return;
        } catch {
            if (i < maxAttempts - 1) {
                console.log(`Waiting for server at ${baseUrl}... (attempt ${i + 1}/${maxAttempts})`);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }
    throw new Error(`Server at ${baseUrl} failed to start within timeout period`);
}

// ===== Shared Test Data and Constants =====
// Mock certificate configuration response (aligns with production CMP config server)
const MOCK_CERT_CONFIG_RESPONSE = {
    certIssuer: "CN=SAP PKI Certificate Service Client CA,OU=SAP BTP Clients,O=SAP SE,L=cf-us10-integrate,C=DE",
    certSubject: "CN=cmp-dev,OU=SAP Cloud Platform Clients,OU=Integrate,OU=cmp-cf-us10-integrate,O=SAP SE,L=Dev,C=DE",
    rootCA: "-----BEGIN CERTIFICATE-----\nMIN05R+AInPkbpKxo+\nLv\n-----END CERTIFICATE-----\n\n",
    ordAggregatorVersion: "1.10.0",
    openResourceDiscovery: {
        adoptedVersion: "1.10.0",
        validatorVersion: "5.2.1",
    },
};

// Root CA DN extracted from this certificate (must match plugin-parsed DN)
const MOCK_ROOT_CA_DN = "CN=SAP Cloud Root CA,O=SAP SE,L=Walldorf,C=DE";

// Used for mismatch/untrusted scenarios
const DIFFERENT_ISSUER = "CN=Different CA,O=Other Org,C=US";
const DIFFERENT_SUBJECT = "CN=different-service,O=Other Org,C=US";
const UNTRUSTED_ROOT_CA = "CN=Untrusted Root CA,O=Untrusted Org,C=US";

/**
 * Start mock CMP config server on specified port
 * @param {number} port - Port number for the mock server
 * @returns {Promise<http.Server>} - The HTTP server instance
 */
async function startMockConfigServer(port) {
    // Check port availability first
    const available = await isPortAvailable(port);
    if (!available) {
        throw new Error(`Port ${port} is already in use. Cannot start mock config server.`);
    }

    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            if (req.method === "GET" && req.url === "/v1/info") {
                console.log(`Mock /v1/info endpoint called on port ${port}`);
                const body = JSON.stringify(MOCK_CERT_CONFIG_RESPONSE);
                res.writeHead(200, {
                    "content-type": "application/json",
                    "content-length": Buffer.byteLength(body),
                });
                res.end(body);
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        server.listen(port, () => {
            console.log(`Mock config server started on http://localhost:${port}/v1/info`);
            resolve(server);
        });
    });
}

/**
 * Stop mock config server
 * @param {http.Server} server - The HTTP server instance to stop
 */
function stopMockConfigServer(server) {
    return new Promise((resolve) => {
        if (server) {
            server.close(() => {
                console.log("Mock config server stopped");
                resolve();
            });
        } else {
            resolve();
        }
    });
}

/**
 * Build mock mTLS headers as sent by CF gorouter
 * Includes XFCC headers indicating proxy verification
 */
function createMtlsHeaders(issuer, subject, rootCaDn) {
    return {
        // XFCC headers indicating proxy has verified the certificate
        "x-forwarded-client-cert": "Hash=abc123;Subject=CN=test",
        "x-ssl-client": "1",
        "x-ssl-client-verify": "0",
        // Certificate DN headers (corrected to match actual gorouter headers)
        "x-ssl-client-issuer-dn": Buffer.from(issuer).toString("base64"),
        "x-ssl-client-subject-dn": Buffer.from(subject).toString("base64"),
        "x-ssl-client-root-ca-dn": Buffer.from(rootCaDn).toString("base64"),
    };
}

// ============================================================================
// Test Suite 1: Environment Variable Priority
// ============================================================================
describe("ORD Integration Tests - mTLS via CF_MTLS_TRUSTED_CERTS (Environment Variable Priority)", () => {
    const BASE_URL = "http://localhost:4005";
    const TEST_APP_ROOT = path.join(__dirname, "integration-test-app");
    const TEMP_CONFIG_PATH = path.join(TEST_APP_ROOT, ".cdsrc.temp-wrong.json");

    let serverProcess;

    beforeAll(async () => {
        console.log("\n=== Test Suite 1: Environment Variable Priority ===");

        // 1. Create temporary wrong config file dynamically
        const wrongConfig = {
            ord: {
                authentication: {
                    cfMtls: {
                        certs: [],
                        configEndpoints: ["http://localhost:8888/wrong-endpoint"], // Wrong endpoint
                        rootCaDn: ["CN=Wrong Root CA,O=Wrong Org,C=US"], // Wrong root CA
                    },
                },
            },
        };
        fs.writeFileSync(TEMP_CONFIG_PATH, JSON.stringify(wrongConfig, null, 4));
        console.log("Created temporary wrong config to prove env var override");

        // 2. Prepare CORRECT mTLS config via environment variable (directly provides certs)
        // Note: We don't start a mock server here because CF_MTLS_TRUSTED_CERTS
        // directly provides the cert info - no fetching needed
        const mtlsConfig = {
            certs: [
                {
                    issuer: MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                    subject: MOCK_CERT_CONFIG_RESPONSE.certSubject,
                },
            ],
            rootCaDn: [MOCK_ROOT_CA_DN],
        };

        // 3. Start CDS with CF_MTLS_TRUSTED_CERTS (should override wrong config file)
        serverProcess = spawn("npx", ["cds", "run"], {
            cwd: TEST_APP_ROOT,
            env: {
                ...process.env,
                PORT: "4005",
                CF_MTLS_TRUSTED_CERTS: JSON.stringify(mtlsConfig), // Correct config in env var
                CDS_CONFIG: TEMP_CONFIG_PATH, // Use temporary wrong config
            },
            stdio: ["ignore", "pipe", "pipe"],
        });

        serverProcess.stdout.on("data", (data) => {
            const out = data.toString().trim();
            if (out) console.log("[CDS-ENV]", out);
        });

        serverProcess.stderr.on("data", (data) => {
            const out = data.toString().trim();
            if (out) console.error("[CDS-ENV ERR]", out);
        });

        serverProcess.on("exit", (code, signal) => {
            if (code !== null && code !== 0) {
                console.error(`CDS process exited with code ${code}`);
            }
            if (signal) {
                console.error(`CDS process killed with signal ${signal}`);
            }
        });

        // 4. Wait for service readiness
        await waitForServer(BASE_URL);

        console.log("=== Test Suite 1 Setup Complete ===\n");
    }, 120000);

    afterAll(async () => {
        console.log("\nCleaning up Test Suite 1...");

        // CRITICAL: Strict cleanup order
        // 1. Stop CDS server first
        if (serverProcess && !serverProcess.killed) {
            console.log("Stopping CDS server...");
            await new Promise((resolve) => {
                const cleanup = () => {
                    console.log("CDS server stopped");
                    serverProcess = null;
                    resolve();
                };

                serverProcess.on("exit", cleanup);
                serverProcess.kill("SIGTERM");

                setTimeout(() => {
                    if (serverProcess && !serverProcess.killed) {
                        console.log("Force killing CDS server...");
                        serverProcess.kill("SIGKILL");
                        setTimeout(cleanup, 500);
                    }
                }, 3000);
            });
        }

        // 2. Remove temporary config file
        if (fs.existsSync(TEMP_CONFIG_PATH)) {
            fs.unlinkSync(TEMP_CONFIG_PATH);
            console.log("Removed temporary config file");
        }

        console.log("Test Suite 1 cleanup complete\n");
    }, 10000);

    // ========== Environment Variable Priority Tests ==========
    describe("Environment Variable Priority - Proof of Override", () => {
        test("should prove CF_MTLS_TRUSTED_CERTS overrides wrong .cdsrc.json config", async () => {
            // .cdsrc.json has wrong configEndpoint and wrong rootCaDn
            // But env var has correct config, so this should succeed
            const mtlsHeaders = createMtlsHeaders(
                MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                MOCK_CERT_CONFIG_RESPONSE.certSubject,
                MOCK_ROOT_CA_DN,
            );

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(200);

            expect(response.body).toHaveProperty("openResourceDiscovery", "1.12");
        });
    });

    // ========== Valid mTLS scenarios ==========
    describe("mTLS Authentication - Valid Scenarios", () => {
        test("should accept valid mTLS headers for ORD document endpoint", async () => {
            const mtlsHeaders = createMtlsHeaders(
                MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                MOCK_CERT_CONFIG_RESPONSE.certSubject,
                MOCK_ROOT_CA_DN,
            );

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(200);

            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(response.body).toHaveProperty("openResourceDiscovery", "1.12");
        });

        test("should return ORD config without authentication (endpoint is always open)", async () => {
            const response = await request(BASE_URL).get(ORD_CONFIG_ENDPOINT).expect(200);

            expect(response.body).toHaveProperty("openResourceDiscoveryV1");
        });

        test("should accept mTLS headers with DN components in different order", async () => {
            const reorderedIssuer =
                "C=DE,L=cf-us10-integrate,O=SAP SE,OU=SAP BTP Clients,CN=SAP PKI Certificate Service Client CA";
            const reorderedSubject =
                "C=DE,L=Dev,O=SAP SE,OU=cmp-cf-us10-integrate,OU=Integrate,OU=SAP Cloud Platform Clients,CN=cmp-dev";
            const reorderedRootCa = "C=DE,L=Walldorf,O=SAP SE,CN=SAP Cloud Root CA";

            const mtlsHeaders = createMtlsHeaders(reorderedIssuer, reorderedSubject, reorderedRootCa);

            await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(200);
        });
    });

    // ========== Invalid certificate scenarios ==========
    describe("mTLS Authentication - Invalid Certificate Scenarios", () => {
        test("should reject request with missing issuer header", async () => {
            const headers = {
                "x-ssl-client-subject-dn": Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certSubject).toString("base64"),
                "x-ssl-client-root-ca-dn": Buffer.from(MOCK_ROOT_CA_DN).toString("base64"),
            };

            await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(headers).expect(401);
        });

        test("should reject request with missing subject header", async () => {
            const headers = {
                "x-ssl-client-issuer-dn": Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certIssuer).toString("base64"),
                "x-ssl-client-root-ca-dn": Buffer.from(MOCK_ROOT_CA_DN).toString("base64"),
            };

            await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(headers).expect(401);
        });

        test("should reject request with missing root CA header", async () => {
            const headers = {
                "x-ssl-client-issuer-dn": Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certIssuer).toString("base64"),
                "x-ssl-client-subject-dn": Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certSubject).toString("base64"),
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
    });

    // ========== ORD document structure ==========
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

        test("should have 'sap:cmp-mtls:v1' accessStrategies in all resources", () => {
            // Verify API resources have 'sap:cmp-mtls:v1' accessStrategies
            ordDocument.apiResources.forEach((apiResource) => {
                apiResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.accessStrategies).toEqual(expect.arrayContaining([{ type: "sap:cmp-mtls:v1" }]));
                    expect(resDef.accessStrategies.some((s) => s.type === "sap:cmp-mtls:v1")).toBe(true);
                });
            });

            // Verify Event resources have 'sap:cmp-mtls:v1' accessStrategies
            ordDocument.eventResources.forEach((eventResource) => {
                eventResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.accessStrategies).toEqual(expect.arrayContaining([{ type: "sap:cmp-mtls:v1" }]));
                    expect(resDef.accessStrategies.some((s) => s.type === "sap:cmp-mtls:v1")).toBe(true);
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

// ============================================================================
// Test Suite 2: .cdsrc.json Configuration with fetchMtlsCertInfo
// ============================================================================
describe("ORD Integration Tests - mTLS via .cdsrc.json configEndpoint (fetchMtlsCertInfo)", () => {
    const BASE_URL = "http://localhost:4006";
    const MOCK_SERVER_PORT = 9999; // Match existing .cdsrc.mtls.json configuration
    const MOCK_CONFIG_ENDPOINT = `http://localhost:${MOCK_SERVER_PORT}/v1/info`;
    const TEST_APP_ROOT = path.join(__dirname, "integration-test-app");

    let serverProcess;
    let mockConfigServer;

    beforeAll(async () => {
        console.log("\n=== Test Suite 2: .cdsrc.json Configuration with fetchMtlsCertInfo ===");

        // 1. Start mock config server (matches existing .cdsrc.mtls.json port)
        mockConfigServer = await startMockConfigServer(MOCK_SERVER_PORT);

        // 2. Start CDS WITHOUT CF_MTLS_TRUSTED_CERTS env var
        // This forces the plugin to fetch from configEndpoint in .cdsrc.mtls.json
        serverProcess = spawn("npx", ["cds", "run"], {
            cwd: TEST_APP_ROOT,
            env: {
                ...process.env,
                PORT: "4006",
                CF_MTLS_TRUSTED_CERTS: undefined, // Explicitly remove env var
                CDS_CONFIG: path.join(TEST_APP_ROOT, ".cdsrc.mtls.json"), // Use existing mTLS config
            },
            stdio: ["ignore", "pipe", "pipe"],
        });

        serverProcess.stdout.on("data", (data) => {
            const out = data.toString().trim();
            if (out) console.log("[CDS-CDSRC]", out);
        });

        serverProcess.stderr.on("data", (data) => {
            const out = data.toString().trim();
            if (out) console.error("[CDS-CDSRC ERR]", out);
        });

        serverProcess.on("exit", (code, signal) => {
            if (code !== null && code !== 0) {
                console.error(`CDS process exited with code ${code}`);
            }
            if (signal) {
                console.error(`CDS process killed with signal ${signal}`);
            }
        });

        // 4. Wait for service readiness
        await waitForServer(BASE_URL);

        console.log("=== Test Suite 2 Setup Complete ===\n");
    }, 120000);

    afterAll(async () => {
        console.log("\nCleaning up Test Suite 2...");

        // CRITICAL: Strict cleanup order
        // 1. Stop CDS server first
        if (serverProcess && !serverProcess.killed) {
            console.log("Stopping CDS server...");
            await new Promise((resolve) => {
                const cleanup = () => {
                    console.log("CDS server stopped");
                    serverProcess = null;
                    resolve();
                };

                serverProcess.on("exit", cleanup);
                serverProcess.kill("SIGTERM");

                setTimeout(() => {
                    if (serverProcess && !serverProcess.killed) {
                        console.log("Force killing CDS server...");
                        serverProcess.kill("SIGKILL");
                        setTimeout(cleanup, 500);
                    }
                }, 3000);
            });
        }

        // 2. Stop mock config server
        await stopMockConfigServer(mockConfigServer);

        console.log("Test Suite 2 cleanup complete\n");
    }, 10000);

    // ========== fetchMtlsCertInfo Integration Tests ==========
    describe("fetchMtlsCertInfo - Config Endpoint Fetch", () => {
        test("should fetch cert info from mock endpoint during startup", async () => {
            // Verify the mock endpoint is accessible and returns expected data
            const response = await fetch(MOCK_CONFIG_ENDPOINT);
            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data).toMatchObject({
                certIssuer: MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                certSubject: MOCK_CERT_CONFIG_RESPONSE.certSubject,
                rootCA: expect.stringContaining("BEGIN CERTIFICATE"),
            });
        });

        test("should use fetched cert info to validate mTLS requests", async () => {
            // This verifies the complete flow:
            // 1. Plugin reads configEndpoint from .cdsrc.json
            // 2. Calls fetchMtlsCertInfo to get cert info from mock endpoint
            // 3. Uses fetched info to validate incoming mTLS requests
            const mtlsHeaders = createMtlsHeaders(
                MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                MOCK_CERT_CONFIG_RESPONSE.certSubject,
                MOCK_ROOT_CA_DN,
            );

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(200);

            // Success means fetchMtlsCertInfo worked correctly
            expect(response.body).toHaveProperty("openResourceDiscovery", "1.12");
        });

        test("should reject requests with cert info not matching fetched config", async () => {
            // Use different cert info than what was fetched from endpoint
            const mtlsHeaders = createMtlsHeaders(DIFFERENT_ISSUER, DIFFERENT_SUBJECT, MOCK_ROOT_CA_DN);

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(403);

            expect(response.text).toContain("Invalid client certificate");
        });

        test("should verify mock endpoint structure matches expected schema", async () => {
            const response = await fetch(MOCK_CONFIG_ENDPOINT);
            const data = await response.json();

            // Verify structure matches what fetchMtlsCertInfo expects
            expect(data).toHaveProperty("certIssuer");
            expect(data).toHaveProperty("certSubject");
            expect(data).toHaveProperty("rootCA");
            expect(data.certIssuer).toContain("CN=SAP PKI Certificate Service Client CA");
            expect(data.certSubject).toContain("CN=cmp-dev");
        });
    });

    // ========== Valid mTLS scenarios (same as Suite 1) ==========
    describe("mTLS Authentication - Valid Scenarios", () => {
        test("should accept valid mTLS headers for ORD document endpoint", async () => {
            const mtlsHeaders = createMtlsHeaders(
                MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                MOCK_CERT_CONFIG_RESPONSE.certSubject,
                MOCK_ROOT_CA_DN,
            );

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(200);

            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(response.body).toHaveProperty("openResourceDiscovery", "1.12");
        });

        test("should return ORD config without authentication (endpoint is always open)", async () => {
            const response = await request(BASE_URL).get(ORD_CONFIG_ENDPOINT).expect(200);

            expect(response.body).toHaveProperty("openResourceDiscoveryV1");
        });

        test("should accept mTLS headers with DN components in different order", async () => {
            const reorderedIssuer =
                "C=DE,L=cf-us10-integrate,O=SAP SE,OU=SAP BTP Clients,CN=SAP PKI Certificate Service Client CA";
            const reorderedSubject =
                "C=DE,L=Dev,O=SAP SE,OU=cmp-cf-us10-integrate,OU=Integrate,OU=SAP Cloud Platform Clients,CN=cmp-dev";
            const reorderedRootCa = "C=DE,L=Walldorf,O=SAP SE,CN=SAP Cloud Root CA";

            const mtlsHeaders = createMtlsHeaders(reorderedIssuer, reorderedSubject, reorderedRootCa);

            await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(200);
        });
    });

    // ========== Invalid certificate scenarios (same as Suite 1) ==========
    describe("mTLS Authentication - Invalid Certificate Scenarios", () => {
        test("should reject request with missing issuer header", async () => {
            const headers = {
                "x-ssl-client-subject-dn": Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certSubject).toString("base64"),
                "x-ssl-client-root-ca-dn": Buffer.from(MOCK_ROOT_CA_DN).toString("base64"),
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

        test("should reject untrusted root CA", async () => {
            const mtlsHeaders = createMtlsHeaders(
                MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                MOCK_CERT_CONFIG_RESPONSE.certSubject,
                UNTRUSTED_ROOT_CA,
            );

            const response = await request(BASE_URL).get(ORD_DOCUMENT_ENDPOINT).set(mtlsHeaders).expect(403);

            expect(response.text).toContain("Untrusted certificate authority");
        });
    });

    // ========== ORD document structure ==========
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

        test("should have 'sap:cmp-mtls:v1' accessStrategies in all resources", () => {
            // Verify API resources have 'sap:cmp-mtls:v1' accessStrategies
            ordDocument.apiResources.forEach((apiResource) => {
                apiResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.accessStrategies).toEqual(expect.arrayContaining([{ type: "sap:cmp-mtls:v1" }]));
                    expect(resDef.accessStrategies.some((s) => s.type === "sap:cmp-mtls:v1")).toBe(true);
                });
            });

            // Verify Event resources have 'sap:cmp-mtls:v1' accessStrategies
            ordDocument.eventResources.forEach((eventResource) => {
                eventResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.accessStrategies).toEqual(expect.arrayContaining([{ type: "sap:cmp-mtls:v1" }]));
                    expect(resDef.accessStrategies.some((s) => s.type === "sap:cmp-mtls:v1")).toBe(true);
                });
            });
        });
    });
});
