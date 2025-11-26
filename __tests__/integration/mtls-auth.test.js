const request = require("supertest");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const BASE_URL = "http://localhost:4005";
const ORD_CONFIG_ENDPOINT = "/.well-known/open-resource-discovery";
const ORD_DOCUMENT_ENDPOINT = "/ord/v1/documents/ord-document";

let serverProcess;
let mockConfigServer;

/**
 * Wait for CDS server to be ready
 * Only checks port connectivity, not status codes
 */
async function waitForServer(maxAttempts = 30, delayMs = 500) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await request(BASE_URL).get(ORD_CONFIG_ENDPOINT);
            console.log("CDS server is ready");
            return;
        } catch {
            if (i < maxAttempts - 1) {
                console.log(`Waiting for CDS server... (attempt ${i + 1}/${maxAttempts})`);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }
    throw new Error("Server failed to start within timeout period");
}

// ===== Mock Config Server Setup =====
const MOCK_CONFIG_SERVER_PORT = 9999;
const MOCK_CONFIG_ENDPOINT = `http://localhost:${MOCK_CONFIG_SERVER_PORT}/v1/info`;

// Note: Align this structure with your production CMP config server
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

function startMockConfigServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            if (req.method === "GET" && req.url === "/v1/info") {
                console.log("Mock /v1/info endpoint called");
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

        server.listen(MOCK_CONFIG_SERVER_PORT, () => {
            console.log(`Mock config server started on ${MOCK_CONFIG_ENDPOINT}`);
            mockConfigServer = server;
            resolve();
        });
    });
}

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
 * Build mock mTLS headers as sent by CF gorouter
 */
function createMtlsHeaders(issuer, subject, rootCaDn) {
    return {
        "x-forwarded-client-cert-issuer-dn": Buffer.from(issuer).toString("base64"),
        "x-forwarded-client-cert-subject-dn": Buffer.from(subject).toString("base64"),
        "x-forwarded-client-cert-root-ca-dn": Buffer.from(rootCaDn).toString("base64"),
    };
}

describe("ORD Integration Tests - CF mTLS Authentication (pure mTLS)", () => {
    beforeAll(async () => {
        console.log("\n=== Starting mTLS Integration Test Setup ===");

        // 1. Start mock CMP config server
        await startMockConfigServer();

        // 2. Prepare mTLS config (same structure as CF_MTLS_TRUSTED_CERTS)
        const mtlsConfig = {
            certs: [],
            rootCaDn: [MOCK_ROOT_CA_DN],
            configEndpoints: [MOCK_CONFIG_ENDPOINT],
        };

        const testAppRoot = path.join(__dirname, "integration-test-app");

        console.log("Test app root:", testAppRoot);

        // 3. Start CDS with pure mTLS (simplified approach)
        serverProcess = spawn("npx", ["cds", "run"], {
            cwd: testAppRoot,
            env: {
                ...process.env,
                PORT: "4005", // Set port to match BASE_URL
                ORD_AUTH_TYPE: JSON.stringify(["cf-mtls"]), // Enable only mTLS
                CF_MTLS_TRUSTED_CERTS: JSON.stringify(mtlsConfig),
            },
            stdio: ["ignore", "pipe", "pipe"],
        });

        serverProcess.stdout.on("data", (data) => {
            const out = data.toString().trim();
            if (out) console.log("[CDS]", out);
        });

        serverProcess.stderr.on("data", (data) => {
            const out = data.toString().trim();
            if (out) {
                console.error("[CDS ERR]", out);
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

        // 4. Wait for service readiness
        await waitForServer();

        console.log("=== mTLS Test Setup Complete ===\n");
    }, 60000);

    afterAll(async () => {
        // Stop CDS first
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

        // Then stop the mock config server
        await stopMockConfigServer();
    }, 10000);

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
    });
});
