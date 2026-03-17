const {
    getIntegrationDependencies,
    collectExternalServices,
    createIntegrationDependency,
    createEventIntegrationDependency,
    EVENT_INTEGRATION_DEPENDENCY_RESOURCE_NAME,
} = require("../../lib/integrationDependency");
const { RESOURCE_VISIBILITY } = require("../../lib/constants");
const { registerIntegrationDependencyProvider, _clearProviders } = require("../../lib/extensionRegistry");

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
                        "kind": "service",
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
                        "kind": "service",
                        "@cds.external": true,
                        "@data.product": true,
                        "@cds.dp.ordId": "sap.sai:apiResource:Supplier:v1",
                    },
                    "sap.sai.Invoice.v2": {
                        "kind": "service",
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
                        "kind": "service",
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
                        "kind": "service",
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
                        "kind": "service",
                        "@cds.external": true,
                        "@data.product": true,
                        "@cds.dp.ordId": "sap.sai:apiResource:Supplier:v1",
                    },
                    "sap.sai.Invoice.v1": {
                        "kind": "service",
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

    describe("createEventIntegrationDependency", () => {
        beforeEach(() => {
            _clearProviders();
        });

        it("should return null when no providers are registered", () => {
            const result = createEventIntegrationDependency(mockAppConfig, mockPackageIds);
            expect(result).toBeNull();
        });

        it("should return null when provider returns null", () => {
            registerIntegrationDependencyProvider(() => null);

            const result = createEventIntegrationDependency(mockAppConfig, mockPackageIds);
            expect(result).toBeNull();
        });

        it("should create Event Integration Dependency from provider data", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: [
                    {
                        ordId: "sap.s4:eventResource:CE_SALESORDEREVENTS:v1",
                        events: ["sap.s4.beh.salesorder.v1.SalesOrder.Changed.v1"],
                    },
                ],
            }));

            const result = createEventIntegrationDependency(mockAppConfig, mockPackageIds);

            expect(result).not.toBeNull();
            expect(result.ordId).toBe("customer.testapp:integrationDependency:consumedEvents:v1");
            expect(result.title).toBe("Consumed Events");
            expect(result.version).toBe("1.0.0");
            expect(result.releaseStatus).toBe("active");
            expect(result.visibility).toBe(RESOURCE_VISIBILITY.public);
            expect(result.partOfPackage).toBe("customer.testapp:package:testapp-integrationDependency:v1");
        });

        it("should create valid eventResources aspect with subset", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: [
                    {
                        ordId: "sap.s4:eventResource:CE_SALESORDEREVENTS:v1",
                        events: [
                            "sap.s4.beh.salesorder.v1.SalesOrder.Changed.v1",
                            "sap.s4.beh.salesorder.v1.SalesOrder.Created.v1",
                        ],
                    },
                ],
            }));

            const result = createEventIntegrationDependency(mockAppConfig, mockPackageIds);

            expect(result.aspects).toHaveLength(1);
            expect(result.aspects[0].title).toBe("Subscribed Event Types");
            expect(result.aspects[0].mandatory).toBe(false);
            expect(result.aspects[0].eventResources).toHaveLength(1);
            expect(result.aspects[0].eventResources[0].ordId).toBe("sap.s4:eventResource:CE_SALESORDEREVENTS:v1");
            // ORD plugin builds subset from events
            expect(result.aspects[0].eventResources[0].subset).toHaveLength(2);
            expect(result.aspects[0].eventResources[0].subset[0].eventType).toBe(
                "sap.s4.beh.salesorder.v1.SalesOrder.Changed.v1",
            );
        });

        it("should merge eventResources from multiple providers", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: [
                    {
                        ordId: "sap.s4:eventResource:CE_SALESORDEREVENTS:v1",
                        events: ["event1"],
                    },
                ],
            }));
            registerIntegrationDependencyProvider(() => ({
                eventResources: [
                    {
                        ordId: "sap.s4:eventResource:CE_BUSINESSPARTNEREVENTS:v1",
                        events: ["event2"],
                    },
                ],
            }));

            const result = createEventIntegrationDependency(mockAppConfig, mockPackageIds);

            // Should have all eventResources merged
            expect(result.aspects[0].eventResources).toHaveLength(2);
        });

        it("should return null when provider returns empty eventResources", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: [],
            }));

            const result = createEventIntegrationDependency(mockAppConfig, mockPackageIds);
            expect(result).toBeNull();
        });

        it("should apply eventIntegrationDependency config from cdsrc", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: [
                    {
                        ordId: "sap.s4:eventResource:CE_SALESORDEREVENTS:v1",
                        events: ["event1"],
                    },
                ],
            }));

            const appConfigWithCdsrc = {
                ...mockAppConfig,
                env: {
                    eventIntegrationDependency: {
                        title: "Custom Event Dependencies",
                        description: "Custom description",
                        aspect: {
                            title: "Custom Aspect Title",
                        },
                    },
                },
            };

            const result = createEventIntegrationDependency(appConfigWithCdsrc, mockPackageIds);

            expect(result.title).toBe("Custom Event Dependencies");
            expect(result.description).toBe("Custom description");
            expect(result.aspects[0].title).toBe("Custom Aspect Title");
        });
    });

    describe("getIntegrationDependencies with Event Provider", () => {
        beforeEach(() => {
            _clearProviders();
        });

        it("should return both API and Event Integration Dependencies", () => {
            // Register event provider
            registerIntegrationDependencyProvider(() => ({
                eventResources: [
                    {
                        ordId: "sap.s4:eventResource:CE_EVENTS:v1",
                        events: ["sap.s4.event1"],
                    },
                ],
            }));

            const csn = {
                definitions: {
                    "sap.sai.Supplier.v1": {
                        "kind": "service",
                        "@cds.external": true,
                        "@data.product": true,
                        "@cds.dp.ordId": "sap.sai:apiResource:Supplier:v1",
                    },
                },
            };

            const result = getIntegrationDependencies(csn, mockAppConfig, mockPackageIds);

            expect(result).toHaveLength(2);
            expect(result[0].ordId).toContain("externalDependencies");
            expect(result[1].ordId).toContain("consumedEvents");
        });

        it("should return only Event Integration Dependency when no external services", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: [
                    {
                        ordId: "sap.s4:eventResource:CE_EVENTS:v1",
                        events: ["sap.s4.event1"],
                    },
                ],
            }));

            const csn = {
                definitions: {
                    MyService: { kind: "service" },
                },
            };

            const result = getIntegrationDependencies(csn, mockAppConfig, mockPackageIds);

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toContain("consumedEvents");
        });
    });

    describe("EVENT_INTEGRATION_DEPENDENCY_RESOURCE_NAME", () => {
        it("should be exported with correct value", () => {
            expect(EVENT_INTEGRATION_DEPENDENCY_RESOURCE_NAME).toBe("consumedEvents");
        });
    });
});
