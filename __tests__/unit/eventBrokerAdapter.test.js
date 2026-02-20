// Mock cds module - must be before requiring any modules that use cds
jest.mock("@sap/cds", () => {
    const mockLogger = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
    };
    return {
        env: {},
        services: {},
        log: jest.fn(() => mockLogger),
    };
});

const {
    isEventBrokerConfigured,
    isEventBrokerReady,
    getEventBrokerConfigs,
    extractNamespaceFromCredentials,
    getConsumedEventTypesFromService,
    getAllConsumedEventTypes,
    getEventBrokerNamespace,
    getEventBrokerOrdInfo,
    EVENT_BROKER_KINDS,
    BLOCKED_EVENT_TYPES,
} = require("../../lib/eventBrokerAdapter");

const cds = require("@sap/cds");

describe("eventBrokerAdapter", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset cds.env and cds.services before each test
        cds.env = {};
        cds.services = {};
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("constants", () => {
        test("EVENT_BROKER_KINDS should contain expected kinds", () => {
            expect(EVENT_BROKER_KINDS).toContain("event-broker");
            expect(EVENT_BROKER_KINDS).toContain("event-broker-internal");
        });

        test("BLOCKED_EVENT_TYPES should contain wildcards and error events", () => {
            expect(BLOCKED_EVENT_TYPES).toContain("*");
            expect(BLOCKED_EVENT_TYPES).toContain("cds.messaging.error");
        });
    });

    describe("isEventBrokerConfigured", () => {
        test("should return true when messaging has kind event-broker", () => {
            const envRequires = {
                messaging: {
                    kind: "event-broker",
                },
            };

            const result = isEventBrokerConfigured(envRequires);
            expect(result).toBe(true);
        });

        test("should return true when messaging has kind event-broker-internal", () => {
            const envRequires = {
                messaging: {
                    kind: "event-broker-internal",
                },
            };

            const result = isEventBrokerConfigured(envRequires);
            expect(result).toBe(true);
        });

        test("should return true when vcap label is event-broker", () => {
            const envRequires = {
                messaging: {
                    vcap: {
                        label: "event-broker",
                    },
                },
            };

            const result = isEventBrokerConfigured(envRequires);
            expect(result).toBe(true);
        });

        test("should return true when vcap label is eventmesh-sap2sap-internal", () => {
            const envRequires = {
                messaging: {
                    vcap: {
                        label: "eventmesh-sap2sap-internal",
                    },
                },
            };

            const result = isEventBrokerConfigured(envRequires);
            expect(result).toBe(true);
        });

        test("should return false when messaging has different kind", () => {
            const envRequires = {
                messaging: {
                    kind: "file-based-messaging",
                },
            };

            const result = isEventBrokerConfigured(envRequires);
            expect(result).toBe(false);
        });

        test("should return false when no requires defined", () => {
            const result = isEventBrokerConfigured(undefined);
            expect(result).toBe(false);
        });

        test("should return false when requires is empty", () => {
            const result = isEventBrokerConfigured({});
            expect(result).toBe(false);
        });

        test("should handle null config entries gracefully", () => {
            const envRequires = {
                messaging: null,
                db: {
                    kind: "sqlite",
                },
            };

            const result = isEventBrokerConfigured(envRequires);
            expect(result).toBe(false);
        });

        test("should handle non-object config entries gracefully", () => {
            const envRequires = {
                messaging: "some-string",
                otherService: true,
            };

            const result = isEventBrokerConfigured(envRequires);
            expect(result).toBe(false);
        });
    });

    describe("getEventBrokerConfigs", () => {
        test("should return array of event-broker configs", () => {
            const envRequires = {
                messaging: {
                    kind: "event-broker",
                    credentials: { foo: "bar" },
                },
                db: {
                    kind: "sqlite",
                },
            };

            const result = getEventBrokerConfigs(envRequires);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("messaging");
            expect(result[0].config.kind).toBe("event-broker");
        });

        test("should return multiple event-broker configs", () => {
            const envRequires = {
                "messaging": {
                    kind: "event-broker",
                },
                "messaging-internal": {
                    kind: "event-broker-internal",
                },
            };

            const result = getEventBrokerConfigs(envRequires);
            expect(result).toHaveLength(2);
        });

        test("should return empty array when no event-broker configured", () => {
            const envRequires = {
                db: {
                    kind: "sqlite",
                },
            };

            const result = getEventBrokerConfigs(envRequires);
            expect(result).toHaveLength(0);
        });

        test("should return empty array when requires is undefined", () => {
            const result = getEventBrokerConfigs(undefined);
            expect(result).toHaveLength(0);
        });
    });

    describe("extractNamespaceFromCredentials", () => {
        test("should extract namespace from ceSource array", () => {
            const credentials = {
                ceSource: ["/default/sap.s4/my-namespace"],
            };

            const result = extractNamespaceFromCredentials(credentials);
            expect(result).toBe("my-namespace");
        });

        test("should extract namespace from ceSource string", () => {
            const credentials = {
                ceSource: "/default/sap.s4/my-namespace-string",
            };

            const result = extractNamespaceFromCredentials(credentials);
            expect(result).toBe("my-namespace-string");
        });

        test("should handle complex ceSource path", () => {
            const credentials = {
                ceSource: ["/a/b/c/d/actual-namespace"],
            };

            const result = extractNamespaceFromCredentials(credentials);
            expect(result).toBe("actual-namespace");
        });

        test("should return null when ceSource is missing", () => {
            const credentials = {};

            const result = extractNamespaceFromCredentials(credentials);
            expect(result).toBeNull();
        });

        test("should return null when credentials are null", () => {
            const result = extractNamespaceFromCredentials(null);
            expect(result).toBeNull();
        });

        test("should return null when credentials are undefined", () => {
            const result = extractNamespaceFromCredentials(undefined);
            expect(result).toBeNull();
        });

        test("should return null when ceSource array is empty", () => {
            const credentials = {
                ceSource: [],
            };

            const result = extractNamespaceFromCredentials(credentials);
            expect(result).toBeNull();
        });

        test("should return null when ceSource is invalid type", () => {
            const credentials = {
                ceSource: 12345,
            };

            const result = extractNamespaceFromCredentials(credentials);
            expect(result).toBeNull();
        });
    });

    describe("getConsumedEventTypesFromService", () => {
        test("should return event types from subscribedTopics Set", () => {
            const mockService = {
                subscribedTopics: new Set(["event.type.one", "event.type.two"]),
            };

            const result = getConsumedEventTypesFromService(mockService);
            expect(result).toHaveLength(2);
            expect(result).toContain("event.type.one");
            expect(result).toContain("event.type.two");
        });

        test("should filter out wildcard '*'", () => {
            const mockService = {
                subscribedTopics: new Set(["*", "event.type.one"]),
            };

            const result = getConsumedEventTypesFromService(mockService);
            expect(result).toHaveLength(1);
            expect(result).toContain("event.type.one");
            expect(result).not.toContain("*");
        });

        test("should filter out error events", () => {
            const mockService = {
                subscribedTopics: new Set(["cds.messaging.error", "event.type.one"]),
            };

            const result = getConsumedEventTypesFromService(mockService);
            expect(result).toHaveLength(1);
            expect(result).toContain("event.type.one");
            expect(result).not.toContain("cds.messaging.error");
        });

        test("should return empty array when service is null", () => {
            const result = getConsumedEventTypesFromService(null);
            expect(result).toHaveLength(0);
        });

        test("should return empty array when subscribedTopics is undefined", () => {
            const mockService = {};

            const result = getConsumedEventTypesFromService(mockService);
            expect(result).toHaveLength(0);
        });

        test("should return empty array when subscribedTopics is not a Set", () => {
            const mockService = {
                subscribedTopics: ["event.type.one"],
            };

            const result = getConsumedEventTypesFromService(mockService);
            expect(result).toHaveLength(0);
        });
    });

    describe("getAllConsumedEventTypes", () => {
        test("should aggregate events from multiple EventBroker services", () => {
            cds.services = {
                messaging1: {
                    constructor: { name: "EventBroker" },
                    subscribedTopics: new Set(["event.one"]),
                },
                messaging2: {
                    constructor: { name: "EventBroker" },
                    subscribedTopics: new Set(["event.two"]),
                },
            };

            const result = getAllConsumedEventTypes();
            expect(result).toHaveLength(2);
            expect(result).toContain("event.one");
            expect(result).toContain("event.two");
        });

        test("should detect service by options.kind", () => {
            cds.services = {
                messaging: {
                    constructor: { name: "SomeOtherClass" },
                    options: { kind: "event-broker" },
                    subscribedTopics: new Set(["event.by.kind"]),
                },
            };

            const result = getAllConsumedEventTypes();
            expect(result).toHaveLength(1);
            expect(result).toContain("event.by.kind");
        });

        test("should deduplicate same event types from multiple services", () => {
            cds.services = {
                messaging1: {
                    constructor: { name: "EventBroker" },
                    subscribedTopics: new Set(["shared.event", "unique.one"]),
                },
                messaging2: {
                    constructor: { name: "EventBroker" },
                    subscribedTopics: new Set(["shared.event", "unique.two"]),
                },
            };

            const result = getAllConsumedEventTypes();
            expect(result).toHaveLength(3);
            expect(result).toContain("shared.event");
            expect(result).toContain("unique.one");
            expect(result).toContain("unique.two");
        });

        test("should return empty array when no services", () => {
            cds.services = {};

            const result = getAllConsumedEventTypes();
            expect(result).toHaveLength(0);
        });

        test("should ignore non-EventBroker services", () => {
            cds.services = {
                db: {
                    constructor: { name: "SQLiteService" },
                },
                messaging: {
                    constructor: { name: "EventBroker" },
                    subscribedTopics: new Set(["event.one"]),
                },
            };

            const result = getAllConsumedEventTypes();
            expect(result).toHaveLength(1);
            expect(result).toContain("event.one");
        });

        test("should fallback to ordConfig.consumedEventTypes when no runtime services found", () => {
            cds.services = {};

            const result = getAllConsumedEventTypes({
                ordConfig: {
                    consumedEventTypes: ["sap.s4.beh.businesspartner.v1.BusinessPartner.Changed.v1"],
                },
            });
            expect(result).toHaveLength(1);
            expect(result).toContain("sap.s4.beh.businesspartner.v1.BusinessPartner.Changed.v1");
        });

        test("should handle single string consumedEventTypes in ordConfig", () => {
            cds.services = {};

            const result = getAllConsumedEventTypes({
                ordConfig: {
                    consumedEventTypes: "sap.s4.beh.salesorder.v1.SalesOrder.Created.v1",
                },
            });
            expect(result).toHaveLength(1);
            expect(result).toContain("sap.s4.beh.salesorder.v1.SalesOrder.Created.v1");
        });

        test("should filter blocked event types from ordConfig.consumedEventTypes", () => {
            cds.services = {};

            const result = getAllConsumedEventTypes({
                ordConfig: {
                    consumedEventTypes: ["valid.event.v1", "*", "cds.messaging.error"],
                },
            });
            expect(result).toHaveLength(1);
            expect(result).toContain("valid.event.v1");
            expect(result).not.toContain("*");
            expect(result).not.toContain("cds.messaging.error");
        });

        test("should not use ordConfig when runtime services have events", () => {
            cds.services = {
                messaging: {
                    constructor: { name: "EventBroker" },
                    subscribedTopics: new Set(["runtime.event.v1"]),
                },
            };

            const result = getAllConsumedEventTypes({
                ordConfig: {
                    consumedEventTypes: ["config.event.v1"],
                },
            });
            expect(result).toHaveLength(1);
            expect(result).toContain("runtime.event.v1");
            expect(result).not.toContain("config.event.v1");
        });

        test("should ignore non-string entries in ordConfig.consumedEventTypes", () => {
            cds.services = {};

            const result = getAllConsumedEventTypes({
                ordConfig: {
                    consumedEventTypes: ["valid.event.v1", 123, null, { type: "object" }],
                },
            });
            expect(result).toHaveLength(1);
            expect(result).toContain("valid.event.v1");
        });
    });

    describe("getEventBrokerNamespace", () => {
        test("should return namespace from first event-broker config with credentials", () => {
            const envRequires = {
                messaging: {
                    kind: "event-broker",
                    credentials: {
                        ceSource: ["/default/sap/my-namespace"],
                    },
                },
            };

            const result = getEventBrokerNamespace(envRequires);
            expect(result).toBe("my-namespace");
        });

        test("should return null when no credentials available", () => {
            const envRequires = {
                messaging: {
                    kind: "event-broker",
                },
            };

            const result = getEventBrokerNamespace(envRequires);
            expect(result).toBeNull();
        });

        test("should try multiple configs and return first valid namespace", () => {
            const envRequires = {
                messaging1: {
                    kind: "event-broker",
                    // No credentials
                },
                messaging2: {
                    kind: "event-broker-internal",
                    credentials: {
                        ceSource: ["/path/to/second-namespace"],
                    },
                },
            };

            const result = getEventBrokerNamespace(envRequires);
            expect(result).toBe("second-namespace");
        });
    });

    describe("isEventBrokerReady", () => {
        test("should return true when event-broker is configured", () => {
            const options = {
                envRequires: {
                    messaging: {
                        kind: "event-broker",
                    },
                },
            };

            const result = isEventBrokerReady(options);
            expect(result).toBe(true);
        });

        test("should return false when event-broker is not configured", () => {
            const options = {
                envRequires: {
                    db: {
                        kind: "sqlite",
                    },
                },
            };

            const result = isEventBrokerReady(options);
            expect(result).toBe(false);
        });

        test("should use cds.env.requires by default", () => {
            cds.env = {
                requires: {
                    messaging: {
                        kind: "event-broker",
                    },
                },
            };

            const result = isEventBrokerReady();
            expect(result).toBe(true);
        });
    });

    describe("getEventBrokerOrdInfo", () => {
        beforeEach(() => {
            cds.services = {};
        });

        test("should return null when event-broker is not ready", () => {
            const result = getEventBrokerOrdInfo({
                envRequires: {},
            });

            expect(result).toBeNull();
        });

        test("should return null when no namespace available and no fallback", () => {
            cds.services = {
                messaging: {
                    constructor: { name: "EventBroker" },
                    subscribedTopics: new Set(["event.one"]),
                },
            };

            const result = getEventBrokerOrdInfo({
                envRequires: {
                    messaging: {
                        kind: "event-broker",
                        // No credentials with ceSource
                    },
                },
            });

            expect(result).toBeNull();
        });

        test("should return info with fallback namespace", () => {
            cds.services = {
                messaging: {
                    constructor: { name: "EventBroker" },
                    subscribedTopics: new Set(["event.one"]),
                },
            };

            const result = getEventBrokerOrdInfo({
                envRequires: {
                    messaging: {
                        kind: "event-broker",
                    },
                },
                fallbackNamespace: "customer.myapp",
            });

            expect(result).not.toBeNull();
            expect(result.namespace).toBe("customer.myapp");
            expect(result.eventTypes).toContain("event.one");
            expect(result.hasEvents).toBe(true);
        });

        test("should return info with namespace from credentials", () => {
            cds.services = {
                messaging: {
                    constructor: { name: "EventBroker" },
                    subscribedTopics: new Set(["event.type.created"]),
                },
            };

            const result = getEventBrokerOrdInfo({
                envRequires: {
                    messaging: {
                        kind: "event-broker",
                        credentials: {
                            ceSource: ["/default/sap/real-namespace"],
                        },
                    },
                },
            });

            expect(result).not.toBeNull();
            expect(result.namespace).toBe("real-namespace");
            expect(result.eventTypes).toContain("event.type.created");
            expect(result.hasEvents).toBe(true);
        });

        test("should indicate hasEvents false when no events", () => {
            cds.services = {
                messaging: {
                    constructor: { name: "EventBroker" },
                    subscribedTopics: new Set(), // Empty
                },
            };

            const result = getEventBrokerOrdInfo({
                envRequires: {
                    messaging: {
                        kind: "event-broker",
                        credentials: {
                            ceSource: ["/default/sap/my-namespace"],
                        },
                    },
                },
            });

            expect(result).not.toBeNull();
            expect(result.hasEvents).toBe(false);
            expect(result.eventTypes).toHaveLength(0);
        });
    });
});
