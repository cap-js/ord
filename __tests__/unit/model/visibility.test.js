const { determineVisibility, isPrimaryDataProductService } = require("../../../lib/model/visibility");
const { RESOURCE_VISIBILITY } = require("../../../lib/constants");

describe("visibility", () => {
    describe("determineVisibility", () => {
        const baseConfig = { env: {} };

        test("returns internal for primary data product services", () => {
            const definition = { "@DataIntegration.dataProduct.type": "primary" };
            expect(determineVisibility({}, definition, baseConfig)).toBe(RESOURCE_VISIBILITY.internal);
        });

        test("returns internal for simple data product annotation", () => {
            const definition = { "@data.product": true };
            expect(determineVisibility({}, definition, baseConfig)).toBe(RESOURCE_VISIBILITY.internal);
        });

        test("extensions.visibility takes priority over annotation and default", () => {
            const extensions = { visibility: "internal" };
            const definition = { "@ORD.Extensions.visibility": "public" };
            expect(determineVisibility(extensions, definition, baseConfig)).toBe("internal");
        });

        test("annotation takes priority over default", () => {
            const definition = { "@ORD.Extensions.visibility": "internal" };
            expect(determineVisibility({}, definition, baseConfig)).toBe("internal");
        });

        test("implementationStandard forces public", () => {
            const extensions = { implementationStandard: "cds:service-api:v1" };
            expect(determineVisibility(extensions, {}, baseConfig)).toBe(RESOURCE_VISIBILITY.public);
        });

        test("falls back to config defaultVisibility", () => {
            const config = { env: { defaultVisibility: "internal" } };
            expect(determineVisibility({}, {}, config)).toBe("internal");
        });

        test("falls back to public when no config defaultVisibility", () => {
            expect(determineVisibility({}, {}, baseConfig)).toBe(RESOURCE_VISIBILITY.public);
        });

        test("warns and falls back to public for invalid defaultVisibility", () => {
            const config = { env: { defaultVisibility: "invalid-value" } };
            expect(determineVisibility({}, {}, config)).toBe(RESOURCE_VISIBILITY.public);
        });
    });

    describe("isPrimaryDataProductService", () => {
        test("true for DataIntegration.dataProduct.type = primary", () => {
            expect(isPrimaryDataProductService({ "@DataIntegration.dataProduct.type": "primary" })).toBe(true);
        });

        test("true for @data.product annotation", () => {
            expect(isPrimaryDataProductService({ "@data.product": true })).toBe(true);
        });

        test("false for no annotation", () => {
            expect(isPrimaryDataProductService({})).toBe(false);
        });

        test("false for non-primary data product type", () => {
            expect(isPrimaryDataProductService({ "@DataIntegration.dataProduct.type": "secondary" })).toBe(false);
        });
    });
});
