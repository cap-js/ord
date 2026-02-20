/**
 * E2E tests for Event Broker Integration Dependencies in ORD documents.
 *
 * These tests verify that the ORD plugin correctly generates Integration Dependencies
 * when @cap-js/event-broker is configured.
 */

const cds = require("@sap/cds");
const path = require("path");

// Mock eventBrokerAdapter at module level - must be before requiring ord
jest.mock("../../lib/eventBrokerAdapter", () => ({
    isEventBrokerReady: jest.fn(),
    getEventBrokerOrdInfo: jest.fn(),
}));

// Get the mocked module
const eventBrokerAdapter = require("../../lib/eventBrokerAdapter");

// Mock authentication and date for consistent test results
jest.mock("../../lib/auth/authentication", () => ({
    createAuthConfig: jest.fn(() => ({ accessStrategies: [{ type: "open" }] })),
    createAuthMiddleware: jest.fn(() => (req, res, next) => next()),
}));

jest.mock("../../lib/date", () => ({
    getRFC3339Date: jest.fn(() => "2024-11-04T14:33:25+01:00"),
}));

describe("Event Broker Integration Dependencies E2E", () => {
    let csn;
    let ord;
    let originalEnvOrd;

    beforeAll(async () => {
        cds.root = path.join(__dirname, "../bookshop");
        csn = await cds.load(path.join(cds.root, "srv"));
        ord = require("../../lib/ord");
    });

    beforeEach(() => {
        originalEnvOrd = cds.env?.ord ? JSON.parse(JSON.stringify(cds.env.ord)) : undefined;
        jest.clearAllMocks();
    });

    afterEach(() => {
        if (originalEnvOrd) {
            cds.env.ord = originalEnvOrd;
        } else if (cds.env?.ord) {
            delete cds.env.ord.namespace;
        }
    });

    it("should generate Integration Dependency when Event Broker is ready with consumed events", () => {
        eventBrokerAdapter.isEventBrokerReady.mockReturnValue(true);
        eventBrokerAdapter.getEventBrokerOrdInfo.mockReturnValue({
            namespace: "my-app",
            eventTypes: [
                "sap.s4.beh.businesspartner.v1.BusinessPartner.Changed.v1",
                "sap.s4.beh.salesorder.v1.SalesOrder.Created.v1",
            ],
            hasEvents: true,
        });

        const document = ord(csn);

        expect(document.integrationDependencies).toBeDefined();
        expect(document.integrationDependencies).toHaveLength(1);

        const intDep = document.integrationDependencies[0];
        expect(intDep.ordId).toMatch(/integrationDependency:RawEvent:v1$/);
        expect(intDep.title).toBe("Customer Integration Needs");
        expect(intDep.shortDescription).toBe("Integration dependency for Event Hub event subscriptions");
        expect(intDep.visibility).toBe("public");
        expect(intDep.releaseStatus).toBe("active");
        expect(intDep.mandatory).toBe(false);

        // Verify aspects structure
        expect(intDep.aspects).toHaveLength(1);
        expect(intDep.aspects[0].title).toBe("RawEvent");
        expect(intDep.aspects[0].mandatory).toBe(false);
        expect(intDep.aspects[0].eventResources).toHaveLength(1);

        // Verify event types in subset
        const subset = intDep.aspects[0].eventResources[0].subset;
        expect(subset).toHaveLength(2);
        expect(subset[0].eventType).toBe("sap.s4.beh.businesspartner.v1.BusinessPartner.Changed.v1");
        expect(subset[1].eventType).toBe("sap.s4.beh.salesorder.v1.SalesOrder.Created.v1");
    });

    it("should not generate Integration Dependency when Event Broker is not ready", () => {
        eventBrokerAdapter.isEventBrokerReady.mockReturnValue(false);

        const document = ord(csn);

        expect(document.integrationDependencies).toBeUndefined();
        expect(eventBrokerAdapter.getEventBrokerOrdInfo).not.toHaveBeenCalled();
    });

    it("should not generate Integration Dependency when no consumed events", () => {
        eventBrokerAdapter.isEventBrokerReady.mockReturnValue(true);
        eventBrokerAdapter.getEventBrokerOrdInfo.mockReturnValue({
            namespace: "my-app",
            eventTypes: [],
            hasEvents: false,
        });

        const document = ord(csn);

        expect(document.integrationDependencies).toBeUndefined();
    });

    it("should not generate Integration Dependency when getEventBrokerOrdInfo returns null", () => {
        eventBrokerAdapter.isEventBrokerReady.mockReturnValue(true);
        eventBrokerAdapter.getEventBrokerOrdInfo.mockReturnValue(null);

        const document = ord(csn);

        expect(document.integrationDependencies).toBeUndefined();
    });

    it("should use configured ORD namespace for integrationDependency ordId", () => {
        // Configure custom ORD namespace
        cds.env.ord = cds.env.ord || {};
        cds.env.ord.namespace = "customer.myapp";

        eventBrokerAdapter.isEventBrokerReady.mockReturnValue(true);
        eventBrokerAdapter.getEventBrokerOrdInfo.mockReturnValue({
            namespace: "producer-app",
            eventTypes: ["some.event.type.v1"],
            hasEvents: true,
        });

        const document = ord(csn);

        expect(document.integrationDependencies).toBeDefined();
        const intDep = document.integrationDependencies[0];

        // Integration Dependency uses consuming app's ORD namespace
        expect(intDep.ordId).toBe("customer.myapp:integrationDependency:RawEvent:v1");

        // Event resource references the external source namespace
        expect(intDep.aspects[0].eventResources[0].ordId).toBe("producer-app:eventResource:RawEvent:v1");
    });

    it("should assign Integration Dependency to an existing package", () => {
        eventBrokerAdapter.isEventBrokerReady.mockReturnValue(true);
        eventBrokerAdapter.getEventBrokerOrdInfo.mockReturnValue({
            namespace: "source",
            eventTypes: ["event.type.v1"],
            hasEvents: true,
        });

        const document = ord(csn);

        expect(document.integrationDependencies).toBeDefined();
        const intDep = document.integrationDependencies[0];

        // partOfPackage should reference an existing package
        expect(intDep.partOfPackage).toBeDefined();
        const packageIds = document.packages.map((p) => p.ordId);
        expect(packageIds).toContain(intDep.partOfPackage);
    });

    it("should pass fallbackNamespace to getEventBrokerOrdInfo", () => {
        cds.env.ord = cds.env.ord || {};
        cds.env.ord.namespace = "test.namespace";

        eventBrokerAdapter.isEventBrokerReady.mockReturnValue(true);
        eventBrokerAdapter.getEventBrokerOrdInfo.mockReturnValue({
            namespace: "fallback",
            eventTypes: ["event.v1"],
            hasEvents: true,
        });

        ord(csn);

        expect(eventBrokerAdapter.getEventBrokerOrdInfo).toHaveBeenCalledWith({
            fallbackNamespace: "test.namespace",
        });
    });

    it("should handle single event type", () => {
        eventBrokerAdapter.isEventBrokerReady.mockReturnValue(true);
        eventBrokerAdapter.getEventBrokerOrdInfo.mockReturnValue({
            namespace: "source",
            eventTypes: ["single.event.type.v1"],
            hasEvents: true,
        });

        const document = ord(csn);

        expect(document.integrationDependencies).toBeDefined();
        const subset = document.integrationDependencies[0].aspects[0].eventResources[0].subset;
        expect(subset).toHaveLength(1);
        expect(subset[0].eventType).toBe("single.event.type.v1");
    });

    it("should handle many event types", () => {
        const manyEvents = Array.from({ length: 10 }, (_, i) => `event.type.${i}.v1`);

        eventBrokerAdapter.isEventBrokerReady.mockReturnValue(true);
        eventBrokerAdapter.getEventBrokerOrdInfo.mockReturnValue({
            namespace: "source",
            eventTypes: manyEvents,
            hasEvents: true,
        });

        const document = ord(csn);

        expect(document.integrationDependencies).toBeDefined();
        const subset = document.integrationDependencies[0].aspects[0].eventResources[0].subset;
        expect(subset).toHaveLength(10);
        manyEvents.forEach((eventType, i) => {
            expect(subset[i].eventType).toBe(eventType);
        });
    });
});
