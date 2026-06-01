const path = require("path");

const utils = require("../utils");
const createTestApp = require("../hooks/test-app");
const createMockServer = require("../hooks/mock-server");
const { CF_MTLS_HEADERS, ORD_ACCESS_STRATEGY } = require("../../lib/constants");

const ORD_CONFIG_ENDPOINT = "/.well-known/open-resource-discovery";
const ORD_DOCUMENT_ENDPOINT = "/ord/v1/documents/ord-document";

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

const mockserver = createMockServer(9999, MOCK_CERT_CONFIG_RESPONSE);
const testapp = createTestApp(path.join(__dirname, "integration-test-app"), {
    CDS_CONFIG: ".cdsrc.mtls.json",
});

describe("ORD Integration Tests - mTLS Development Mode (cfMtls object with configEndpoints)", () => {
    // ========== fetchMtlsCertInfo Integration Tests ==========
    describe("fetchMtlsCertInfo - Config Endpoint Fetch", () => {
        test("should fetch cert info from mock endpoint during startup", async () => {
            // Verify the mock endpoint is accessible and returns expected data
            const response = await fetch(`${mockserver.schema}://${mockserver.host}:${mockserver.port}/v1/info`);

            expect(response.ok).toBe(true);
            expect(await response.json()).toMatchObject({
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

            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                headers: utils.createMtlsHeaders(
                    MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                    MOCK_CERT_CONFIG_RESPONSE.certSubject,
                    MOCK_ROOT_CA_DN,
                ),
            });

            // Success means fetchMtlsCertInfo worked correctly
            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(utils.pinLastUpdateForStableTest(response.data)).toMatchSnapshot();
        });

        test("should reject requests with cert info not matching fetched config", async () => {
            // Use different cert info than what was fetched from endpoint
            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                validateStatus: () => true,
                headers: utils.createMtlsHeaders(DIFFERENT_ISSUER, DIFFERENT_SUBJECT, MOCK_ROOT_CA_DN),
            });

            expect(response.status).toBe(403);
            expect(response.data).toContain("Invalid client certificate");
        });

        test("should verify mock endpoint structure matches expected schema", async () => {
            const response = await fetch(`${mockserver.schema}://${mockserver.host}:${mockserver.port}/v1/info`);
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
            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(response.data).toMatchSnapshot();
        });

        test("should accept mTLS headers with DN components in different order", async () => {
            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                headers: utils.createMtlsHeaders(
                    "C=DE,L=cf-us10-integrate,O=SAP SE,OU=SAP BTP Clients,CN=SAP PKI Certificate Service Client CA",
                    "C=DE,L=Dev,O=SAP SE,OU=cmp-cf-us10-integrate,OU=Integrate,OU=SAP Cloud Platform Clients,CN=cmp-dev",
                    "C=DE,L=Walldorf,O=SAP SE,CN=SAP Cloud Root CA",
                ),
            });

            expect(response.status).toBe(200);
        });
    });

    // ========== Invalid certificate scenarios (same as Suite 1) ==========
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
            expect(response.data).toContain("Invalid client certificate");
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
            expect(response.data).toContain("Untrusted certificate authority");
        });
    });

    // ========== ORD document structure ==========
    describe("ORD Document Structure with mTLS", () => {
        let ordDocument;

        beforeAll(async () => {
            const response = await testapp.get(ORD_DOCUMENT_ENDPOINT, {
                headers: utils.createMtlsHeaders(
                    MOCK_CERT_CONFIG_RESPONSE.certIssuer,
                    MOCK_CERT_CONFIG_RESPONSE.certSubject,
                    MOCK_ROOT_CA_DN,
                ),
            });

            ordDocument = response.data;
        });

        test("should have required ORD structure", () => {
            expect(ordDocument).toHaveProperty("openResourceDiscovery", "1.14");
            expect(ordDocument).toHaveProperty("description");
            expect(Array.isArray(ordDocument.apiResources)).toBe(true);
            expect(Array.isArray(ordDocument.eventResources)).toBe(true);
        });

        test("should have 'sap:cmp-mtls:v1' accessStrategies in all resources", () => {
            // Verify API resources have 'sap:cmp-mtls:v1' accessStrategies
            ordDocument.apiResources.forEach((apiResource) => {
                apiResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.accessStrategies).toEqual(
                        expect.arrayContaining([{ type: ORD_ACCESS_STRATEGY.CmpMtls }]),
                    );
                    expect(resDef.accessStrategies.some((s) => s.type === ORD_ACCESS_STRATEGY.CmpMtls)).toBe(true);
                });
            });

            // Verify Event resources have 'sap:cmp-mtls:v1' accessStrategies
            ordDocument.eventResources.forEach((eventResource) => {
                eventResource.resourceDefinitions.forEach((resDef) => {
                    expect(resDef.accessStrategies).toEqual(
                        expect.arrayContaining([{ type: ORD_ACCESS_STRATEGY.CmpMtls }]),
                    );
                    expect(resDef.accessStrategies.some((s) => s.type === ORD_ACCESS_STRATEGY.CmpMtls)).toBe(true);
                });
            });
        });
    });
});
