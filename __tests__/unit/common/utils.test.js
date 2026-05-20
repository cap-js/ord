const { getRFC3339Date, isPrimaryDataProductService } = require("../../../lib/common/utils");

const RFC3339_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

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

describe("date", () => {
    it("tests getRFC3339Date with offset", () => {
        const lastUpdate = getRFC3339Date();
        expect(lastUpdate).toMatch(RFC3339_REGEX);
    });

    it("test regex correctly", () => {
        let lastUpdate = "1985-04-12T23:20:50.52Z";
        expect(lastUpdate).toMatch(RFC3339_REGEX);

        lastUpdate = "2022-12-19T15:47:04+00:00";
        expect(lastUpdate).toMatch(RFC3339_REGEX);

        lastUpdate = "1996-12-19T16:39:57-08:00";
        expect(lastUpdate).toMatch(RFC3339_REGEX);

        lastUpdate = "1937-01-01T12:00:27.87+00:20";
        expect(lastUpdate).toMatch(RFC3339_REGEX);
    });
});
