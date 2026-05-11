const { createEventResources } = require("../../../lib/model/eventResource");

beforeAll(() => {
    const authentication = require("../../../lib/auth/authentication");
    const { mockAuthenticationModule } = require("../utils/test-helpers");
    mockAuthenticationModule(authentication);
});

afterAll(() => {
    jest.restoreAllMocks();
});

describe("event-resource", () => {
    const baseConfig = {
        ordNamespace: "customer.app",
        lastUpdate: "2024-11-04T14:33:25+01:00",
        appName: "test-app",
        env: {},
        policyLevels: ["none"],
    };

    const packageIds = ["customer.app:package:test-event:v1"];

    describe("createEventResources", () => {
        test("creates event resource for public service", () => {
            const service = {
                name: "customer.app.NotificationService",
                definition: { name: "customer.app.NotificationService" },
                extensions: {},
            };
            const resources = createEventResources(service, baseConfig, packageIds, [{ type: "open" }]);
            expect(resources).toHaveLength(1);
            expect(resources[0].ordId).toContain("eventResource");
            expect(resources[0].ordId).toContain("NotificationService");
        });

        test("derives asyncapi resource definition", () => {
            const service = {
                name: "customer.app.EventService",
                definition: { name: "customer.app.EventService" },
                extensions: {},
            };
            const resources = createEventResources(service, baseConfig, packageIds, [{ type: "open" }]);
            expect(resources[0].resourceDefinitions).toHaveLength(1);
            expect(resources[0].resourceDefinitions[0].type).toBe("asyncapi-v2");
            expect(resources[0].resourceDefinitions[0].url).toContain("asyncapi2.json");
        });

        test("returns empty for private services", () => {
            const service = {
                name: "customer.app.PrivateEvents",
                definition: { name: "customer.app.PrivateEvents" },
                extensions: { visibility: "private" },
            };
            expect(createEventResources(service, baseConfig, packageIds, [{ type: "open" }])).toHaveLength(0);
        });

        test("returns empty for non-public/non-internal visibility", () => {
            const service = {
                name: "customer.app.WeirdService",
                definition: { name: "customer.app.WeirdService" },
                extensions: { visibility: "some-other-value" },
            };
            expect(createEventResources(service, baseConfig, packageIds, [{ type: "open" }])).toHaveLength(0);
        });

        test("does not override existing resourceDefinitions from extensions", () => {
            const customDef = [{ type: "custom-type", mediaType: "application/json", url: "/custom" }];
            const service = {
                name: "customer.app.CustomEvent",
                definition: { name: "customer.app.CustomEvent" },
                extensions: { resourceDefinitions: customDef },
            };
            const resources = createEventResources(service, baseConfig, packageIds, [{ type: "open" }]);
            expect(resources[0].resourceDefinitions).toEqual(customDef);
        });
    });
});
