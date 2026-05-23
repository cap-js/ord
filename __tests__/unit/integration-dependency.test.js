const {
    createIntegrationDependency,
} = require("../../lib/templates/integration-dependency");
const { RESOURCE_VISIBILITY } = require("../../lib/constants");

describe("integrationDependency", () => {
    const mockAppConfig = {
        ordNamespace: "customer.testapp",
        appName: "testapp",
        env: {},
    };

    const mockPackageIds = [
        "customer.testapp:package:testapp-integrationDependency:v1",
        "customer.testapp:package:testapp-api:v1",
    ];

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

        it("should allow cdsrc to override version and releaseStatus", () => {
            const appConfigWithCdsrc = {
                ...mockAppConfig,
                env: {
                    integrationDependency: {
                        version: "2.0.0",
                        releaseStatus: "beta",
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

            expect(result.version).toBe("2.0.0");
            expect(result.releaseStatus).toBe("beta");
        });

        it("should allow cdsrc to override visibility and add description", () => {
            const appConfigWithCdsrc = {
                ...mockAppConfig,
                env: {
                    integrationDependency: {
                        visibility: RESOURCE_VISIBILITY.internal,
                        description: "Custom integration dependency description",
                        shortDescription: "Custom short description",
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

            expect(result.visibility).toBe(RESOURCE_VISIBILITY.internal);
            expect(result.description).toBe("Custom integration dependency description");
            expect(result.shortDescription).toBe("Custom short description");
        });
    });
});
