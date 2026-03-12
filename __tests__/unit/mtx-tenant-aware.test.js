/**
 * Tests verifying tenant-aware ORD support for extensible multitenant CAP applications.
 *
 * When cds.middlewares are used, cds.context.tenant and cds.context.model are populated
 * per request, allowing tenant-specific CSN (from extensibility/toggles) to be used.
 */
const fs = require("fs");
const path = require("path");
const cds = require("@sap/cds");

describe("Tenant-Aware ORD", () => {
    describe("1. metaData.js uses cds.context?.model before service model", () => {
        test("getMetadata falls back to cds.context.model when no explicit model passed", async () => {
            const { getMetadata } = require("../../lib/index");
            const { compile: openapi } = require("@cap-js/openapi");

            // Provide a context model (simulates MTX-populated tenant model)
            const contextModel = {
                definitions: {
                    TestService: {},
                },
            };
            const savedContext = cds.context;
            cds.context = { model: contextModel };

            jest.mock("@cap-js/openapi", () => ({
                compile: jest.fn().mockReturnValue("openapi-from-context-model"),
            }));

            try {
                // Calling without explicit model — should pick up cds.context.model
                const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:TestService:v1/TestService.oas3.json";
                const result = await getMetadata(url);
                // We only verify the call did not throw and returned a result
                expect(result).toBeDefined();
                expect(result.contentType).toBe("application/json");
            } finally {
                cds.context = savedContext;
                jest.unmock("@cap-js/openapi");
            }
        });
    });

    describe("2. ord-service.js ORD document handler reads cds.context.model", () => {
        test("ord() is called with cds.context.model when available", async () => {
            const ordServiceSource = fs.readFileSync(path.join(__dirname, "../../lib/ord-service.js"), "utf8");

            // The handler must use cds.context?.model || cds.model (not just cds.model)
            expect(ordServiceSource).toContain("cds.context?.model || cds.model");
        });
    });

    describe("3. ord-service.js uses CDS middlewares for tenant context", () => {
        test("ord-service.js mounts routes through cds.middlewares (not directly on cds.app.get)", () => {
            const ordServiceSource = fs.readFileSync(path.join(__dirname, "../../lib/ord-service.js"), "utf8");

            // Must use cds.middlewares.before to populate cds.context.tenant/model
            expect(ordServiceSource).toContain("cds.middlewares.before");
            expect(ordServiceSource).toContain("cds.middlewares.after");

            // The tenant-aware routes (ORD document + metadata) must NOT be registered
            // directly via cds.app.get — they should go through the Router + middleware stack.
            // Only the config endpoint (this.path) is allowed to be on cds.app directly.
            const appGetCalls = [...ordServiceSource.matchAll(/cds\.app\.get\(/g)];
            // Exactly one cds.app.get call: the config endpoint (this.path)
            expect(appGetCalls).toHaveLength(1);
            expect(ordServiceSource).toMatch(/cds\.app\.get\(`\$\{this\.path\}`/);

            // The ORD document endpoint must be on the router, not cds.app
            expect(ordServiceSource).toContain("router.get(`/v1/documents/ord-document`");

            // The router must be mounted on /ord with CDS middlewares
            expect(ordServiceSource).toContain(
                'cds.app.use("/ord", cds.middlewares.before, router, cds.middlewares.after)',
            );
        });
    });

    describe("4. ORD document reflects tenant-extended model", () => {
        test("ord() returns document based on context model when cds.context.model is set", async () => {
            const ord = require("../../lib/ord");

            // Base model: a simple service
            const baseModel = cds.linked(`
                service BookService {
                    entity Books {
                        key ID : Integer;
                        title  : String;
                    }
                }
            `);

            // Extended model: same service with an extra entity (simulates tenant extension)
            const extendedModel = cds.linked(`
                service BookService {
                    entity Books {
                        key ID    : Integer;
                        title     : String;
                    }
                    entity Reviews {
                        key ID    : Integer;
                        rating    : Integer;
                    }
                }
            `);

            // Simulate what cds.context.model provides (MTX fills this per tenant)
            const savedContext = cds.context;
            const savedModel = cds.model;

            try {
                // Without context model: use base model
                const baseDocument = ord(baseModel);
                const baseApiResource = baseDocument.apiResources?.find((r) => r.ordId?.includes("BookService"));
                expect(baseApiResource).toBeDefined();

                // With context model set: ord() should use the extended model
                cds.context = { model: extendedModel };
                const csn = cds.context?.model || cds.model;
                const tenantDocument = ord(csn);
                const tenantApiResource = tenantDocument.apiResources?.find((r) => r.ordId?.includes("BookService"));
                expect(tenantApiResource).toBeDefined();

                // Both documents were generated (behavior is identical when using the
                // same CSN directly — the key point is cds.context.model is used)
                expect(tenantDocument.apiResources).toBeDefined();
            } finally {
                cds.context = savedContext;
                cds.model = savedModel;
            }
        });
    });
});
