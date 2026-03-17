/**
 * Unit tests for Extension Registry
 */

const {
    registerIntegrationDependencyProvider,
    getProvidedIntegrationDependencies,
    hasIntegrationDependencyProviders,
    _clearProviders,
    _getProviderCount,
} = require("../../lib/extensionRegistry");

describe("extensionRegistry", () => {
    beforeEach(() => {
        // Clear providers before each test
        _clearProviders();
    });

    describe("registerIntegrationDependencyProvider", () => {
        it("should register a provider function", () => {
            const provider = () => ({
                eventResources: [{ ordId: "test:eventResource:Test:v1", events: ["event1"] }],
            });

            expect(_getProviderCount()).toBe(0);
            registerIntegrationDependencyProvider(provider);
            expect(_getProviderCount()).toBe(1);
        });

        it("should allow multiple providers", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: [{ ordId: "test:eventResource:Test1:v1", events: ["event1"] }],
            }));
            registerIntegrationDependencyProvider(() => ({
                eventResources: [{ ordId: "test:eventResource:Test2:v1", events: ["event2"] }],
            }));

            expect(_getProviderCount()).toBe(2);
        });

        it("should throw error for non-function provider", () => {
            expect(() => registerIntegrationDependencyProvider("not a function")).toThrow(
                "Integration Dependency provider must be a function",
            );
            expect(() => registerIntegrationDependencyProvider({})).toThrow(
                "Integration Dependency provider must be a function",
            );
            expect(() => registerIntegrationDependencyProvider(null)).toThrow(
                "Integration Dependency provider must be a function",
            );
        });
    });

    describe("hasIntegrationDependencyProviders", () => {
        it("should return false when no providers registered", () => {
            expect(hasIntegrationDependencyProviders()).toBe(false);
        });

        it("should return true when providers are registered", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: [{ ordId: "test:eventResource:Test:v1", events: ["e1"] }],
            }));
            expect(hasIntegrationDependencyProviders()).toBe(true);
        });
    });

    describe("getProvidedIntegrationDependencies", () => {
        it("should return empty array when no providers registered", () => {
            const result = getProvidedIntegrationDependencies();
            expect(result).toEqual([]);
        });

        it("should return data from single provider", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: [
                    {
                        ordId: "sap.s4:eventResource:CE_SALESORDEREVENTS:v1",
                        events: ["sap.s4.beh.salesorder.v1.SalesOrder.Changed.v1"],
                    },
                ],
            }));

            const result = getProvidedIntegrationDependencies();
            expect(result).toHaveLength(1);
            expect(result[0].eventResources).toHaveLength(1);
            expect(result[0].eventResources[0].ordId).toBe("sap.s4:eventResource:CE_SALESORDEREVENTS:v1");
            expect(result[0].eventResources[0].events).toContain("sap.s4.beh.salesorder.v1.SalesOrder.Changed.v1");
        });

        it("should return data from multiple providers", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: [{ ordId: "test:eventResource:Test1:v1", events: ["event1"] }],
            }));
            registerIntegrationDependencyProvider(() => ({
                eventResources: [
                    { ordId: "test:eventResource:Test2:v1", events: ["event2"] },
                    { ordId: "test:eventResource:Test3:v1", events: ["event3"] },
                ],
            }));

            const result = getProvidedIntegrationDependencies();
            expect(result).toHaveLength(2);
        });

        it("should filter out null results from providers", () => {
            registerIntegrationDependencyProvider(() => null);
            registerIntegrationDependencyProvider(() => ({
                eventResources: [{ ordId: "valid:eventResource:Test:v1", events: ["event1"] }],
            }));

            const result = getProvidedIntegrationDependencies();
            expect(result).toHaveLength(1);
            expect(result[0].eventResources[0].ordId).toBe("valid:eventResource:Test:v1");
        });

        it("should filter out results with empty eventResources array", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: [],
            }));

            const result = getProvidedIntegrationDependencies();
            expect(result).toHaveLength(0);
        });

        it("should filter out results with non-array eventResources", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: "not an array",
            }));

            const result = getProvidedIntegrationDependencies();
            expect(result).toHaveLength(0);
        });

        it("should filter out results without eventResources property", () => {
            registerIntegrationDependencyProvider(() => ({
                namespace: "sap.test",
                events: ["event1"],
            }));

            const result = getProvidedIntegrationDependencies();
            expect(result).toHaveLength(0);
        });

        it("should handle provider errors gracefully", () => {
            registerIntegrationDependencyProvider(() => {
                throw new Error("Provider error");
            });
            registerIntegrationDependencyProvider(() => ({
                eventResources: [{ ordId: "valid:eventResource:Test:v1", events: ["event1"] }],
            }));

            // Should not throw, should filter out failed provider
            const result = getProvidedIntegrationDependencies();
            expect(result).toHaveLength(1);
            expect(result[0].eventResources[0].ordId).toBe("valid:eventResource:Test:v1");
        });
    });

    describe("_clearProviders", () => {
        it("should clear all registered providers", () => {
            registerIntegrationDependencyProvider(() => ({
                eventResources: [{ ordId: "test:eventResource:Test1:v1", events: ["e1"] }],
            }));
            registerIntegrationDependencyProvider(() => ({
                eventResources: [{ ordId: "test:eventResource:Test2:v1", events: ["e2"] }],
            }));

            expect(_getProviderCount()).toBe(2);
            _clearProviders();
            expect(_getProviderCount()).toBe(0);
            expect(hasIntegrationDependencyProviders()).toBe(false);
        });
    });
});
