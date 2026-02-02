const { createAPIResourceTemplate } = require("../../lib/templates");
const { DATA_PRODUCT_ANNOTATION, DATA_PRODUCT_SHORTEN_ANNOTATION, DATA_PRODUCT_TYPE } = require("../../lib/constants");

describe("Version Suffix Extraction for Data Product Services", () => {
    const mockAppConfig = {
        ordNamespace: "sap.test",
        lastUpdate: "2024-01-01T00:00:00Z",
        env: {
            defaultVisibility: "public",
        },
    };

    const mockPackageIds = ["sap.test:package:test:v1"];
    const mockAccessStrategies = [{ type: "open" }];

    describe("Positive Test Cases - Valid v<number> patterns", () => {
        test("should handle .v0 suffix correctly", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v0",
                [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
            };

            const result = createAPIResourceTemplate(
                "DataService.v0",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v0");
            expect(result[0].version).toBe("0.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
        });

        test("should handle .v1 suffix correctly", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v1",
                [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
            };

            const result = createAPIResourceTemplate(
                "DataService.v1",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v1");
            expect(result[0].version).toBe("1.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
        });

        test("should handle .v2 suffix correctly", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v2",
                [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
            };

            const result = createAPIResourceTemplate(
                "DataService.v2",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v2");
            expect(result[0].version).toBe("2.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
        });

        test("should handle .v10 suffix correctly", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v10",
                [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
            };

            const result = createAPIResourceTemplate(
                "DataService.v10",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v10");
            expect(result[0].version).toBe("10.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
        });

        test("should handle complex service names with .v1 suffix", () => {
            const serviceDefinition = {
                name: "sap.test.complex.DataProductService.v1",
                [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
            };

            const result = createAPIResourceTemplate(
                "complex.DataProductService.v1",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:complex.DataProductService:v1");
            expect(result[0].version).toBe("1.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:complex.DataProductService");
        });
    });

    describe("Negative Test Cases - Invalid patterns", () => {
        test("should use current behavior for .v1.1 suffix (invalid pattern)", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v1.1",
                [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
            };

            const result = createAPIResourceTemplate(
                "DataService.v1.1",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService.v1.1:v1");
            expect(result[0].version).toBe("1.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.v1.1");
        });

        test("should use current behavior for .v1.0 suffix (invalid pattern)", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v1.0",
                [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
            };

            const result = createAPIResourceTemplate(
                "DataService.v1.0",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService.v1.0:v1");
            expect(result[0].version).toBe("1.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.v1.0");
        });

        test("should use current behavior for .version1 suffix (invalid pattern)", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.version1",
                [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
            };

            const result = createAPIResourceTemplate(
                "DataService.version1",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService.version1:v1");
            expect(result[0].version).toBe("1.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.version1");
        });

        test("should use current behavior for .beta suffix (invalid pattern)", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.beta",
                [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
            };

            const result = createAPIResourceTemplate(
                "DataService.beta",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService.beta:v1");
            expect(result[0].version).toBe("1.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.beta");
        });

        test("should use current behavior for .v suffix (invalid pattern)", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v",
                [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
            };

            const result = createAPIResourceTemplate(
                "DataService.v",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService.v:v1");
            expect(result[0].version).toBe("1.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.v");
        });
    });

    describe("Edge Case Tests", () => {
        test("should use current behavior for data product service without version suffix", () => {
            const serviceDefinition = {
                name: "sap.test.DataService",
                [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
            };

            const result = createAPIResourceTemplate(
                "DataService",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v1");
            expect(result[0].version).toBe("1.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
        });

        test("should use current behavior for non-data product service with valid version suffix", () => {
            const serviceDefinition = {
                name: "sap.test.RegularService.v2",
                // No DATA_PRODUCT_ANNOTATION - this is a regular service
            };

            const result = createAPIResourceTemplate(
                "RegularService.v2",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:RegularService.v2:v1");
            expect(result[0].version).toBe("1.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:RegularService.v2");
        });

        test("should use current behavior for non-primary data product service", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v2",
                [DATA_PRODUCT_ANNOTATION]: "secondary", // Not primary
            };

            const result = createAPIResourceTemplate(
                "DataService.v2",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService.v2:v1");
            expect(result[0].version).toBe("1.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.v2");
        });
    });

    describe("Data Product Specific Properties", () => {
        test("should maintain data product specific properties with version extraction", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v2",
                [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
            };

            const result = createAPIResourceTemplate(
                "DataService.v2",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].direction).toBe("outbound");
            expect(result[0].apiProtocol).toBe("sap.dp:data-subscription-api:v1");
            expect(result[0].entryPoints).toEqual([]);
            expect(result[0].resourceDefinitions).toHaveLength(1);
            expect(result[0].resourceDefinitions[0].type).toBe("sap-csn-interop-effective-v1");
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v2");
            expect(result[0].version).toBe("2.0.0");
        });
    });

    describe("Tests with @data.product annotation", () => {
        test("should handle .v1 suffix correctly with @data.product annotation", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v1",
                [DATA_PRODUCT_SHORTEN_ANNOTATION]: true,
            };

            const result = createAPIResourceTemplate(
                "DataService.v1",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v1");
            expect(result[0].version).toBe("1.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
            expect(result[0].direction).toBe("outbound");
            expect(result[0].apiProtocol).toBe("sap.dp:data-subscription-api:v1");
        });

        test("should handle .v2 suffix correctly with @data.product annotation", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v2",
                [DATA_PRODUCT_SHORTEN_ANNOTATION]: "yes",
            };

            const result = createAPIResourceTemplate(
                "DataService.v2",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v2");
            expect(result[0].version).toBe("2.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
        });

        test("should use current behavior when @data.product is false", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v2",
                [DATA_PRODUCT_SHORTEN_ANNOTATION]: false,
            };

            const result = createAPIResourceTemplate(
                "DataService.v2",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService.v2:v1");
            expect(result[0].version).toBe("1.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.v2");
        });

        test("should prioritize @DataIntegration.dataProduct.type over @data.product for version extraction", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v3",
                [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                [DATA_PRODUCT_SHORTEN_ANNOTATION]: false,
            };

            const result = createAPIResourceTemplate(
                "DataService.v3",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v3");
            expect(result[0].version).toBe("3.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
        });

        test("should apply @data.product when @DataIntegration.dataProduct.type is not primary", () => {
            const serviceDefinition = {
                name: "sap.test.DataService.v2",
                [DATA_PRODUCT_ANNOTATION]: "secondary",
                [DATA_PRODUCT_SHORTEN_ANNOTATION]: true,
            };

            const result = createAPIResourceTemplate(
                "DataService.v2",
                serviceDefinition,
                mockAppConfig,
                mockPackageIds,
                mockAccessStrategies,
            );

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v2");
            expect(result[0].version).toBe("2.0.0");
            expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
        });
    });
});
