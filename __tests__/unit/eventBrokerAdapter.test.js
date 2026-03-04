const {
    isEventBrokerConfigured,
    getEventBrokerConfigs,
    getEventBrokerNamespace,
    extractNamespaceFromCredentials,
    getEventBrokerMessagingServices,
    getSubscribedTopics,
    isRuntimeContext,
    EVENT_BROKER_KINDS,
} = require("../../lib/eventBrokerAdapter");

describe("eventBrokerAdapter", () => {
    describe("isEventBrokerConfigured", () => {
        it("should return true for event-broker kind", () => {
            const envRequires = {
                messaging: { kind: "event-broker" },
            };
            expect(isEventBrokerConfigured(envRequires)).toBe(true);
        });

        it("should return true for event-broker-ias kind", () => {
            const envRequires = {
                messaging: { kind: "event-broker-ias" },
            };
            expect(isEventBrokerConfigured(envRequires)).toBe(true);
        });

        it("should return false for other messaging kinds", () => {
            const envRequires = {
                messaging: { kind: "file-based-messaging" },
            };
            expect(isEventBrokerConfigured(envRequires)).toBe(false);
        });

        it("should return false when no requires configured", () => {
            expect(isEventBrokerConfigured(undefined)).toBe(false);
            expect(isEventBrokerConfigured(null)).toBe(false);
            expect(isEventBrokerConfigured({})).toBe(false);
        });

        it("should detect via vcap label", () => {
            const envRequires = {
                messaging: { vcap: { label: "event-broker" } },
            };
            expect(isEventBrokerConfigured(envRequires)).toBe(true);
        });
    });

    describe("getEventBrokerConfigs", () => {
        it("should return empty array when no event broker configured", () => {
            expect(getEventBrokerConfigs({})).toEqual([]);
        });

        it("should return event broker configs", () => {
            const envRequires = {
                messaging: { kind: "event-broker", credentials: { ceSource: "/default/sap.s4/test" } },
                other: { kind: "some-service" },
            };
            const configs = getEventBrokerConfigs(envRequires);
            expect(configs).toHaveLength(1);
            expect(configs[0].name).toBe("messaging");
        });
    });

    describe("extractNamespaceFromCredentials", () => {
        it("should extract namespace from ceSource string", () => {
            const credentials = { ceSource: "/default/sap.s4/source-system" };
            expect(extractNamespaceFromCredentials(credentials)).toBe("sap.s4");
        });

        it("should extract namespace from ceSource array", () => {
            const credentials = { ceSource: ["/default/sap.s4/source-system"] };
            expect(extractNamespaceFromCredentials(credentials)).toBe("sap.s4");
        });

        it("should handle ceSource without default prefix", () => {
            const credentials = { ceSource: "/beb-demo-nodejs/local" };
            expect(extractNamespaceFromCredentials(credentials)).toBe("beb-demo-nodejs");
        });

        it("should return null for missing credentials", () => {
            expect(extractNamespaceFromCredentials(null)).toBeNull();
            expect(extractNamespaceFromCredentials({})).toBeNull();
        });

        it("should return null for invalid ceSource format", () => {
            const credentials = { ceSource: "/single" };
            expect(extractNamespaceFromCredentials(credentials)).toBeNull();
        });
    });

    describe("getEventBrokerNamespace", () => {
        it("should extract namespace from event broker credentials", () => {
            const envRequires = {
                "event-broker": {
                    kind: "event-broker",
                    credentials: { ceSource: "/default/sap.s4/source-system" },
                },
            };
            expect(getEventBrokerNamespace(envRequires)).toBe("sap.s4");
        });

        it("should return null when no event broker configured", () => {
            expect(getEventBrokerNamespace({})).toBeNull();
        });
    });

    describe("getEventBrokerMessagingServices", () => {
        it("should return empty array when no services available", () => {
            expect(getEventBrokerMessagingServices({}, {})).toEqual([]);
        });

        it("should return messaging services with subscribedTopics", () => {
            const mockService = {
                subscribedTopics: new Map([["topic1", (handler) => {}]]),
            };
            const services = { messaging: mockService };
            const envRequires = { messaging: { kind: "event-broker" } };

            const result = getEventBrokerMessagingServices(services, envRequires);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("messaging");
        });
    });

    describe("getSubscribedTopics", () => {
        it("should return subscribed topics from Map", () => {
            const mockService = {
                subscribedTopics: new Map([
                    ["sap.s4.beh.businesspartner.v1.BusinessPartner.Changed.v1", () => {}],
                    ["sap.s4.beh.salesorder.v1.SalesOrder.Created.v1", () => {}],
                ]),
            };
            const services = { messaging: mockService };
            const envRequires = { messaging: { kind: "event-broker" } };

            const topics = getSubscribedTopics(services, envRequires);
            expect(topics).toContain("sap.s4.beh.businesspartner.v1.BusinessPartner.Changed.v1");
            expect(topics).toContain("sap.s4.beh.salesorder.v1.SalesOrder.Created.v1");
        });

        it("should filter out wildcards and error topics", () => {
            const mockService = {
                subscribedTopics: new Map([
                    ["*", () => {}],
                    ["messaging/error", () => {}],
                    ["sap.s4.event.v1", () => {}],
                ]),
            };
            const services = { messaging: mockService };
            const envRequires = { messaging: { kind: "event-broker" } };

            const topics = getSubscribedTopics(services, envRequires);
            expect(topics).not.toContain("*");
            expect(topics).not.toContain("messaging/error");
            expect(topics).toContain("sap.s4.event.v1");
        });

        it("should handle Set-based subscribedTopics", () => {
            const mockService = {
                subscribedTopics: new Set(["topic1", "topic2"]),
            };
            const services = { messaging: mockService };
            const envRequires = { messaging: { kind: "event-broker" } };

            const topics = getSubscribedTopics(services, envRequires);
            expect(topics).toContain("topic1");
            expect(topics).toContain("topic2");
        });

        it("should handle array-based subscribedTopics", () => {
            const mockService = {
                subscribedTopics: ["topic1", "topic2"],
            };
            const services = { messaging: mockService };
            const envRequires = { messaging: { kind: "event-broker" } };

            const topics = getSubscribedTopics(services, envRequires);
            expect(topics).toContain("topic1");
            expect(topics).toContain("topic2");
        });
    });

    describe("isRuntimeContext", () => {
        it("should return true when services have entries", () => {
            expect(isRuntimeContext({ service1: {} })).toBe(true);
        });

        it("should return false when services is empty", () => {
            expect(isRuntimeContext({})).toBe(false);
        });

        it("should return false when services is null/undefined", () => {
            expect(isRuntimeContext(null)).toBeFalsy();
            expect(isRuntimeContext(undefined)).toBeFalsy();
        });
    });

    describe("EVENT_BROKER_KINDS", () => {
        it("should include expected kinds", () => {
            expect(EVENT_BROKER_KINDS).toContain("event-broker");
            expect(EVENT_BROKER_KINDS).toContain("event-broker-ias");
        });
    });
});
