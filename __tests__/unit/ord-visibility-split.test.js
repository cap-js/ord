const { ORD_ACCESS_STRATEGY } = require("../../lib/constants");
const { createAPIResourceTemplate, _getPackageID } = require("../../lib/templates");

describe("templates", () => {
    const appConfig = {
        ordNamespace: "customer.testNamespace",
        appName: "testAppName",
        lastUpdate: "2022-12-19T15:47:04+00:00",
        policyLevels: ["none"],
        authConfig: {
            accessStrategies: [ORD_ACCESS_STRATEGY.Open],
        },
    };

    describe("createAPIResourceTemplate", () => {
        const packageIds = [
            "sap.test.cdsrc.sample:package:test-api:v1",
            "sap.test.cdsrc.sample:package:test-api-private:v1",
            "sap.test.cdsrc.sample:package:test-api-internal:v1",
        ];

        it("should assign the correct partOfPackage for public API", () => {
            const serviceDefinition = {
                "@ORD.Extensions.visibility": "public",
                "entities": [],
                "name": "PublicAPI",
                "kind": "service",
            };

            const apiResource = createAPIResourceTemplate(serviceDefinition, appConfig, packageIds, {});

            expect(apiResource).not.toBeNull();
            expect(apiResource[0].partOfPackage).toBe("sap.test.cdsrc.sample:package:test-api:v1");
        });

        it("should assign the correct partOfPackage for internal API", () => {
            const serviceDefinition = {
                "@ORD.Extensions.visibility": "internal",
                "entities": [],
                "name": "InternalAPI",
                "kind": "service",
            };

            const apiResource = createAPIResourceTemplate(serviceDefinition, appConfig, packageIds, {});

            expect(apiResource).not.toBeNull();
            expect(apiResource[0].partOfPackage).toBe("sap.test.cdsrc.sample:package:test-api-internal:v1");
        });

        it("should return null for private API", () => {
            const serviceDefinition = { "@ORD.Extensions.visibility": "private", "entities": [], "name": "PrivateAPI" };

            const apiResource = createAPIResourceTemplate(serviceDefinition, appConfig, packageIds, {});

            expect(apiResource).toHaveLength(0);
        });
    });

    describe("_getPackageID", () => {
        const packageIds = [
            "sap.test:package:test-entityType-public:v1",
            "sap.test:package:test-api-xyz:v1",
            "customer.testNamespace:package:fallback-package:v1",
        ];

        it("should use visibility-specific logic when resourceType is provided", () => {
            const result = _getPackageID("customer.testNamespace", packageIds, "entityType", "public");
            expect(result).toBe("sap.test:package:test-entityType-public:v1");
        });

        it("should use simple pattern when no visibility is specified", () => {
            const result = _getPackageID(
                "customer.testNamespace",
                ["sap.test:package:test-simple-entityType-match:v1"],
                "entityType",
            );
            expect(result).toBe("sap.test:package:test-simple-entityType-match:v1");
        });

        it("should use namespace fallback when no resourceType is provided", () => {
            const result = _getPackageID("customer.testNamespace", packageIds);
            expect(result).toBe("customer.testNamespace:package:fallback-package:v1");
        });

        it("should return undefined when no packageIds are provided", () => {
            const result = _getPackageID("customer.testNamespace");
            expect(result).toBeUndefined();
        });
    });
});
