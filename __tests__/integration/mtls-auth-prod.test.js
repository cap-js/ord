const path = require("path");

const utils = require("../utils");
const createTestApp = require("../hooks/test-app");
const { CF_MTLS_HEADERS, ORD_ACCESS_STRATEGY } = require("../../lib/constants");

const ORD_CONFIG_ENDPOINT = "/.well-known/open-resource-discovery";
const ORD_DOCUMENT_ENDPOINT = "/ord/v1/documents/ord-document";

// ===== Shared Test Data and Constants =====
// Mock certificate configuration response (aligns with production CMP config server)
const MOCK_CERT_CONFIG_RESPONSE = {
    certIssuer: "CN=SAP PKI Certificate Service Client CA,OU=SAP BTP Clients,O=SAP SE,L=cf-us10-integrate,C=DE",
    certSubject: "CN=cmp-dev,OU=SAP Cloud Platform Clients,OU=Integrate,OU=cmp-cf-us10-integrate,O=SAP SE,L=Dev,C=DE",
};

// Root CA DN extracted from this certificate (must match plugin-parsed DN)
const MOCK_ROOT_CA_DN = "CN=SAP Cloud Root CA,O=SAP SE,L=Walldorf,C=DE";

// Used for mismatch/untrusted scenarios
const DIFFERENT_ISSUER = "CN=Different CA,O=Other Org,C=US";
const DIFFERENT_SUBJECT = "CN=different-service,O=Other Org,C=US";
const UNTRUSTED_ROOT_CA = "CN=Untrusted Root CA,O=Untrusted Org,C=US";

const testapp = createTestApp(path.join(__dirname, "integration-test-app"), {
    CDS_CONFIG: ".cdsrc.mtls-prod.json",
    CF_MTLS_TRUSTED_CERTS: JSON.stringify({
        rootCaDn: [MOCK_ROOT_CA_DN],
        accessStrategies: [ORD_ACCESS_STRATEGY.CmpMtls, ORD_ACCESS_STRATEGY.BahMtls],
        certs: [
            {
                issuer: MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                subject: MOCK_CERT_CONFIG_RESPONSE.certSubject,
            },
        ],
    }),
});

describe("ORD Integration Tests - mTLS Production Mode (cfMtls: true)", () => {
    // ========== Production Mode Tests ==========
    describe("Production Mode - cfMtls: true with CF_MTLS_TRUSTED_CERTS", () => {
        test("should work with cfMtls: true when CF_MTLS_TRUSTED_CERTS provides cert config", async () => {
            // cfMtls: true in config file declares intent to use mTLS
            // CF_MTLS_TRUSTED_CERTS env var provides the actual cert configuration
            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                headers: utils.createMtlsHeaders(
                    MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                    MOCK_CERT_CONFIG_RESPONSE.certSubject,
                    MOCK_ROOT_CA_DN,
                ),
            });

            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(utils.pinLastUpdateForStableTest(response.data)).toMatchSnapshot();
        });
    });

    // ========== Valid mTLS scenarios ==========
    describe("mTLS Authentication - Valid Scenarios", () => {
        test("should accept valid mTLS headers for ORD document endpoint", async () => {
            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                headers: utils.createMtlsHeaders(
                    MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                    MOCK_CERT_CONFIG_RESPONSE.certSubject,
                    MOCK_ROOT_CA_DN,
                ),
            });

            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(utils.pinLastUpdateForStableTest(response.data)).toMatchSnapshot();
        });

        test("should return ORD config without authentication (endpoint is always open)", async () => {
            const response = await testapp.get(ORD_CONFIG_ENDPOINT);

            expect(response.status).toBe(200);
            expect(response.data).toMatchSnapshot();
        });

        test("should return ORD config for all perspectives without authentication (endpoint is always open)", async () => {
            const response = await testapp.get(ORD_CONFIG_ENDPOINT, { headers: { "local-tenant-id": "12-34-56" } });

            expect(response.status).toBe(200);
            expect(response.data).toMatchSnapshot();
        });

        test("should accept mTLS headers with DN components in different order", async () => {
            const mtlsHeaders = utils.createMtlsHeaders(
                "C=DE,L=cf-us10-integrate,O=SAP SE,OU=SAP BTP Clients,CN=SAP PKI Certificate Service Client CA",
                "C=DE,L=Dev,O=SAP SE,OU=cmp-cf-us10-integrate,OU=Integrate,OU=SAP Cloud Platform Clients,CN=cmp-dev",
                "C=DE,L=Walldorf,O=SAP SE,CN=SAP Cloud Root CA",
            );

            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, { headers: mtlsHeaders });

            expect(response.status).toBe(200);
        });
    });

    // ========== Invalid certificate scenarios ==========
    describe("mTLS Authentication - Invalid Certificate Scenarios", () => {
        test("should reject request with missing issuer header", async () => {
            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                validateStatus: () => true,
                headers: {
                    [CF_MTLS_HEADERS.ROOT_CA]: Buffer.from(MOCK_ROOT_CA_DN).toString("base64"),
                    [CF_MTLS_HEADERS.SUBJECT]: Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certSubject).toString("base64"),
                },
            });

            expect(response.status).toBe(401);
        });

        test("should reject request with missing subject header", async () => {
            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                validateStatus: () => true,
                headers: {
                    [CF_MTLS_HEADERS.ROOT_CA]: Buffer.from(MOCK_ROOT_CA_DN).toString("base64"),
                    [CF_MTLS_HEADERS.ISSUER]: Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certIssuer).toString("base64"),
                },
            });

            expect(response.status).toBe(401);
        });

        test("should reject request with missing root CA header", async () => {
            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                validateStatus: () => true,
                headers: {
                    [CF_MTLS_HEADERS.ISSUER]: Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certIssuer).toString("base64"),
                    [CF_MTLS_HEADERS.SUBJECT]: Buffer.from(MOCK_CERT_CONFIG_RESPONSE.certSubject).toString("base64"),
                },
            });

            expect(response.status).toBe(401);
        });

        test("should reject certificate pair mismatch (valid issuer, wrong subject)", async () => {
            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                validateStatus: () => true,
                headers: utils.createMtlsHeaders(
                    MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                    DIFFERENT_SUBJECT,
                    MOCK_ROOT_CA_DN,
                ),
            });

            expect(response.status).toBe(403);
            expect(response.data).toBe("Forbidden: Invalid client certificate");
        });

        test("should reject certificate pair mismatch (wrong issuer, valid subject)", async () => {
            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                validateStatus: () => true,
                headers: utils.createMtlsHeaders(
                    DIFFERENT_ISSUER,
                    MOCK_CERT_CONFIG_RESPONSE.certSubject,
                    MOCK_ROOT_CA_DN,
                ),
            });

            expect(response.status).toBe(403);
            expect(response.data).toBe("Forbidden: Invalid client certificate");
        });

        test("should reject both issuer and subject mismatch", async () => {
            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                validateStatus: () => true,
                headers: utils.createMtlsHeaders(DIFFERENT_ISSUER, DIFFERENT_SUBJECT, MOCK_ROOT_CA_DN),
            });

            expect(response.status).toBe(403);
            expect(response.data).toBe("Forbidden: Invalid client certificate");
        });

        test("should reject untrusted root CA", async () => {
            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                validateStatus: () => true,
                headers: utils.createMtlsHeaders(
                    MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                    MOCK_CERT_CONFIG_RESPONSE.certSubject,
                    UNTRUSTED_ROOT_CA,
                ),
            });

            expect(response.status).toBe(403);
            expect(response.data).toBe("Forbidden: Untrusted certificate authority");
        });
    });

    // ========== ORD document structure ==========
    describe("ORD Document Structure with mTLS and system-version perspective", () => {
        test("should have required ORD structure", async () => {
            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                headers: {
                    ...utils.createMtlsHeaders(
                        MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                        MOCK_CERT_CONFIG_RESPONSE.certSubject,
                        MOCK_ROOT_CA_DN,
                    ),
                },
            });

            expect(response.status).toBe(200);
            expect(utils.pinLastUpdateForStableTest(response.data)).toMatchSnapshot();
        });
    });

    describe("ORD Document Structure with mTLS and system-instance perspective", () => {
        test("should have required ORD structure", async () => {
            const response = await testapp.get("/ord/v1/documents/ord-document?perspective=system-instance", {
                headers: {
                    "Local-Tenant-Id": "12-34-56",
                    ...utils.createMtlsHeaders(
                        MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                        MOCK_CERT_CONFIG_RESPONSE.certSubject,
                        MOCK_ROOT_CA_DN,
                    ),
                },
            });

            expect(response.status).toBe(200);
            expect(utils.pinLastUpdateForStableTest(response.data)).toMatchSnapshot();
        });
    });
});
