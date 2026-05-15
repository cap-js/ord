const { isPrimaryDataProductService } = require("../../../lib/common/utils");

describe("isPrimaryDataProductService", () => {
    it("returns true for @DataIntegration.dataProduct.type: 'primary'", () => {
        const serviceDefinition = { "@DataIntegration.dataProduct.type": "primary" };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
    });

    it("returns false for @DataIntegration.dataProduct.type: 'secondary'", () => {
        const serviceDefinition = { "@DataIntegration.dataProduct.type": "secondary" };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(false);
    });

    it("returns true for @data.product with truthy value", () => {
        const serviceDefinition = { "@data.product": true };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
    });

    it("returns true for @data.product with any truthy value", () => {
        const serviceDefinition = { "@data.product": "yes" };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
    });

    it("returns false for @data.product with falsy value", () => {
        const serviceDefinition = { "@data.product": false };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(false);
    });

    it("returns false for service with no data product annotations", () => {
        const serviceDefinition = { "@title": "Regular Service" };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(false);
    });

    it("returns true when both annotations are present - @DataIntegration.dataProduct.type takes precedence", () => {
        const serviceDefinition = {
            "@DataIntegration.dataProduct.type": "primary",
            "@data.product": false,
        };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
    });

    it("returns true when both annotations are present with @data.product truthy", () => {
        const serviceDefinition = {
            "@DataIntegration.dataProduct.type": "secondary",
            "@data.product": true,
        };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
    });

    it("returns false when both annotations are present with falsy values", () => {
        const serviceDefinition = {
            "@DataIntegration.dataProduct.type": "secondary",
            "@data.product": false,
        };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(false);
    });
});
