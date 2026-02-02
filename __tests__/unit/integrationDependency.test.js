const {
    getIntegrationDependencies,
    collectExternalServices,
    createIntegrationDependency,
} = require("../../lib/integrationDependency");
const { RESOURCE_VISIBILITY } = require("../../lib/constants");

describe("integrationDependency", () => {
    const mockAppConfig = {
        ordNamespace: "customer.testapp",
        appName: "testapp",
        lastUpdate: "2024-01-15T10:00:00+00:00",
        env: {},
    };

    const mockPackageIds = [
        "customer.testapp:package:testapp-integrationDependency:v1",
        "customer.testapp:package:testapp-api:v1",
    ];

    describe("collectExternalServices", () => {
        it("should return empty array when no external services exist", () => {
            const csn = {
                definitions: {
                    MyService: { kind: "service" },
                },
            };
            const result = collectExternalServices(csn);
            expect(result).toEqual([]);
        });

        it("should collect external services with @cds.dp.ordId annotation", () => {
            const csn = {
                definitions: {
                    "sap.sai.Supplier.v1": {
                        kind: "service",
                        "@cds.external": true,
                        "@data.product": true,
                        "@cds.dp.ordId": "sap.sai:apiResource:Supplier:v1",
                    },
                },
            };
            const result = collectExternalServices(csn);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                serviceName: "sap.sai.Supplier.v1",
                ordId: "sap.sai:apiResource:Supplier:v1",
                minVersion: "1.0.0",
                definition: csn.definitions["sap.sai.Supplier.v1"],
            });
        });

        it("should collect multiple external services", () => {
            const csn = {
                definitions: {
                    "sap.sai.Supplier.v1": {
                        kind: "service",
                        "@cds.external": true,
                        "@data.product": true,
                        "@cds.dp.ordId": "sap.sai:apiResource:Supplier:v1",
                    },
                    "sap.sai.Invoice.v2": {
                        kind: "service",
                        "@cds.external": true,
                        "@data.product": true,
                        "@cds.dp.ordId": "sap.sai:apiResource:Invoice:v2",
                    },
                },
            };
            const result = collectExternalServices(csn);
            expect(result).toHaveLength(2);
        });

        it("should skip eventResource types (only apiResource supported for now)", () => {
            const csn = {
                definitions: {
                    "sap.sai.SupplierEvents.v1": {
                        kind: "service",
                        "@cds.external": true,
                        "@data.product": true,
                        "@cds.dp.ordId": "sap.sai:eventResource:SupplierEvents:v1",
                    },
                },
            };
            const result = collectExternalServices(csn);
            expect(result).toHaveLength(0);
        });

        it("should skip services without @cds.external annotation", () => {
            const csn = {
                definitions: {
                    "sap.sai.Supplier.v1": {
                        kind: "service",
                        "@data.product": true,
                        "@cds.dp.ordId": "sap.sai:apiResource:Supplier:v1",
                    },
                },
            };
            const result = collectExternalServices(csn);
            expect(result).toHaveLength(0);
        });
    });

    describe("createIntegrationDependency", () => {
        it("should create a single IntegrationDependency with correct structure", () => {
            const externalServices = [
                {
                    serviceName: "sap.sai.Supplier.v1",
                    ordId: "sap.sai:apiResource:Supplier:v1",
                    minVersion: "1.0.0",
                    definition: {},
                },
            ];

            const result = createIntegrationDependency(externalServices, mockAppConfig, mockPackageIds);

            expect(result.ordId).toBe("customer.testapp:integrationDependency:externalDependencies:v1");
            expect(result.title).toBe("External Dependencies");
            expect(result.version).toBe("1.0.0");
            expect(result.releaseStatus).toBe("active");
            expect(result.visibility).toBe(RESOURCE_VISIBILITY.public);
            expect(result.mandatory).toBe(false);
            expect(result.lastUpdate).toBe(mockAppConfig.lastUpdate);
            expect(result.partOfPackage).toBe("customer.testapp:package:testapp-integrationDependency:v1");
        });

        it("should create one aspect per external service", () => {
            const externalServices = [
                {
                    serviceName: "sap.sai.Supplier.v1",
                    ordId: "sap.sai:apiResource:Supplier:v1",
                    minVersion: "1.0.0",
                    definition: {},
                },
                {
                    serviceName: "sap.sai.Invoice.v1",
                    ordId: "sap.sai:apiResource:Invoice:v1",
                    minVersion: "1.0.0",
                    definition: {},
                },
            ];

            const result = createIntegrationDependency(externalServices, mockAppConfig, mockPackageIds);

            expect(result.aspects).toHaveLength(2);
            expect(result.aspects[0].title).toBe("sap.sai.Supplier.v1");
            expect(result.aspects[0].mandatory).toBe(false);
            expect(result.aspects[0].apiResources).toEqual([
                { ordId: "sap.sai:apiResource:Supplier:v1", minVersion: "1.0.0" },
            ]);
            expect(result.aspects[1].title).toBe("sap.sai.Invoice.v1");
        });

        it("should apply @ORD.Extensions from service definition to aspect", () => {
            const externalServices = [
                {
                    serviceName: "sap.sai.Supplier.v1",
                    ordId: "sap.sai:apiResource:Supplier:v1",
                    minVersion: "1.0.0",
                    definition: {
                        "@ORD.Extensions.title": "Custom Supplier API",
                        "@ORD.Extensions.mandatory": false,
                        "@ORD.Extensions.description": "Custom description",
                    },
                },
            ];

            const result = createIntegrationDependency(externalServices, mockAppConfig, mockPackageIds);

            expect(result.aspects[0].title).toBe("Custom Supplier API");
            expect(result.aspects[0].mandatory).toBe(false);
            expect(result.aspects[0].description).toBe("Custom description");
        });

        it("should apply integrationDependency config from cdsrc", () => {
            const appConfigWithCdsrc = {
                ...mockAppConfig,
                env: {
                    integrationDependency: {
                        title: "Custom Integration Title",
                        mandatory: true,
                    },
                },
            };

            const externalServices = [
                {
                    serviceName: "sap.sai.Supplier.v1",
                    ordId: "sap.sai:apiResource:Supplier:v1",
                    minVersion: "1.0.0",
                    definition: {},
                },
            ];

            const result = createIntegrationDependency(externalServices, appConfigWithCdsrc, mockPackageIds);

            expect(result.title).toBe("Custom Integration Title");
            expect(result.mandatory).toBe(true);
        });
    });

    describe("getIntegrationDependencies", () => {
        it("should return empty array when no external services exist", () => {
            const csn = {
                definitions: {
                    MyService: { kind: "service" },
                },
            };

            const result = getIntegrationDependencies(csn, mockAppConfig, mockPackageIds);

            expect(result).toEqual([]);
        });

        it("should return array with single IntegrationDependency", () => {
            const csn = {
                definitions: {
                    "sap.sai.Supplier.v1": {
                        kind: "service",
                        "@cds.external": true,
                        "@data.product": true,
                        "@cds.dp.ordId": "sap.sai:apiResource:Supplier:v1",
                    },
                    "sap.sai.Invoice.v1": {
                        kind: "service",
                        "@cds.external": true,
                        "@data.product": true,
                        "@cds.dp.ordId": "sap.sai:apiResource:Invoice:v1",
                    },
                },
            };

            const result = getIntegrationDependencies(csn, mockAppConfig, mockPackageIds);

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("customer.testapp:integrationDependency:externalDependencies:v1");
            expect(result[0].aspects).toHaveLength(2);
        });
    });
});
