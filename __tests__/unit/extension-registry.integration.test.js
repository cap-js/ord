/**
 * Integration test for Extension Registry with Integration Dependency
 *
 * This test simulates the Event Broker plugin registering a provider
 * and verifies that the ORD document includes the Integration Dependency.
 */

// Import from the ORD plugin
const { registerIntegrationDependencyProvider, _clearProviders } = require("../../lib/extension-registry");
const { getIntegrationDependencies } = require("../../lib/integration-dependency");

describe("Extension Registry Integration", () => {
    const mockAppConfig = {
        ordNamespace: "customer.bebdemo",
        appName: "bebdemo",
        env: {},
    };

    const mockPackageIds = [
        "customer.bebdemo:package:bebdemo-integrationDependency:v1",
        "customer.bebdemo:package:bebdemo-api:v1",
    ];

    beforeEach(() => {
        _clearProviders();
    });

    describe("Simulated Event Broker Provider", () => {
        it("should generate Integration Dependency when Event Broker provider is registered", () => {
            // Simulate what Event Broker plugin does at startup - provides {ordId, events}
            registerIntegrationDependencyProvider(() => ({
                eventResources: [
                    {
                        ordId: "sap.s4:eventResource:CE_SALESORDEREVENTS:v1",
                        events: [
                            "sap.s4.beh.salesorder.v1.SalesOrder.Changed.v1",
                            "sap.s4.beh.businesspartner.v1.BusinessPartner.Created.v1",
                        ],
                    },
                ],
            }));

            // CSN with no external services (only event consumption)
            const csn = {
                definitions: {
                    TestService: { kind: "service" },
                },
            };

            const result = getIntegrationDependencies(csn, mockAppConfig, mockPackageIds);

            // Should have exactly 1 Integration Dependency (for consumed events)
            expect(result).toHaveLength(1);

            const eventDep = result[0];
            expect(eventDep.ordId).toBe("customer.bebdemo:integrationDependency:consumedEvents:v1");
            expect(eventDep.title).toBe("Consumed Events");
            expect(eventDep.aspects).toHaveLength(1);
            expect(eventDep.aspects[0].eventResources).toHaveLength(1);
            expect(eventDep.aspects[0].eventResources[0].ordId).toBe("sap.s4:eventResource:CE_SALESORDEREVENTS:v1");
            // ORD plugin builds subset from events
            expect(eventDep.aspects[0].eventResources[0].subset).toHaveLength(2);
            expect(eventDep.aspects[0].eventResources[0].subset[0].eventType).toBe(
                "sap.s4.beh.salesorder.v1.SalesOrder.Changed.v1",
            );
        });

        it("should generate both API and Event Integration Dependencies", () => {
            // Register Event Broker provider
            registerIntegrationDependencyProvider(() => ({
                eventResources: [
                    {
                        ordId: "sap.s4:eventResource:CE_SALESORDEREVENTS:v1",
                        events: ["sap.s4.beh.salesorder.v1.SalesOrder.Changed.v1"],
                    },
                ],
            }));

            // CSN with external data product service
            const csn = {
                definitions: {
                    "sap.sai.Supplier.v1": {
                        "kind": "service",
                        "@cds.external": true,
                        "@data.product": true,
                        "@cds.dp.ordId": "sap.sai:apiResource:Supplier:v1",
                    },
                    "TestService": { kind: "service" },
                },
            };

            const result = getIntegrationDependencies(csn, mockAppConfig, mockPackageIds);

            // Should have 2 Integration Dependencies
            expect(result).toHaveLength(2);

            // First: API-based (external dependencies)
            expect(result[0].ordId).toContain("externalDependencies");
            expect(result[0].aspects[0].apiResources).toBeDefined();

            // Second: Event-based (consumed events)
            expect(result[1].ordId).toContain("consumedEvents");
            expect(result[1].aspects[0].eventResources).toBeDefined();
        });

        it("should not generate Integration Dependency when provider returns null", () => {
            registerIntegrationDependencyProvider(() => null);

            const csn = {
                definitions: {
                    TestService: { kind: "service" },
                },
            };

            const result = getIntegrationDependencies(csn, mockAppConfig, mockPackageIds);

            expect(result).toHaveLength(0);
        });

        it("should handle provider returning empty eventResources", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: [],
            }));

            const csn = {
                definitions: {
                    TestService: { kind: "service" },
                },
            };

            const result = getIntegrationDependencies(csn, mockAppConfig, mockPackageIds);

            expect(result).toHaveLength(0);
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

            const csn = {
                definitions: {
                    TestService: { kind: "service" },
                },
            };

            const result = getIntegrationDependencies(csn, mockAppConfig, mockPackageIds);

            expect(result).toHaveLength(1);
            // Should have all eventResources merged
            expect(result[0].aspects[0].eventResources).toHaveLength(2);
        });
    });

    describe("Event Broker config-based eventResources simulation", () => {
        it("should build eventResources from config and subscribed events", () => {
            // Simulate the Event Broker's buildEventResourcesFromConfig logic
            const eventResourcesConfig = [
                {
                    ordId: "sap.s4:eventResource:CE_BUSINESSPARTNEREVENTS:v1",
                    eventTypes: ["sap.s4.beh.businesspartner.v1.BusinessPartner.Changed.v1"],
                },
            ];
            const subscribedEvents = ["sap.s4.beh.businesspartner.v1.BusinessPartner.Changed.v1"];

            // Simulate matching logic - Event Broker returns {ordId, events}
            const subscribedSet = new Set(subscribedEvents);
            const eventResources = [];

            for (const config of eventResourcesConfig) {
                const matchedEventTypes = config.eventTypes.filter((et) => subscribedSet.has(et));
                if (matchedEventTypes.length > 0) {
                    eventResources.push({
                        ordId: config.ordId,
                        events: matchedEventTypes, // Simple array, not subset structure
                    });
                }
            }

            expect(eventResources).toHaveLength(1);
            expect(eventResources[0].ordId).toBe("sap.s4:eventResource:CE_BUSINESSPARTNEREVENTS:v1");
            expect(eventResources[0].events).toHaveLength(1);
            expect(eventResources[0].events[0]).toBe("sap.s4.beh.businesspartner.v1.BusinessPartner.Changed.v1");
        });
    });
});
