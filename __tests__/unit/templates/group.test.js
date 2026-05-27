const { createGroupsTemplateForService, RESOLVERS } = require("../../../lib/templates/group");
const defaults = require("../../../lib/defaults");
const cds = require("@sap/cds");
const { ORD_ACCESS_STRATEGY } = require("../../../lib/constants");

const BASE_SERVICE = {
    name: "sap.test.BusinessPartnerService",
};

const BASE_APP_CONFIG = {
    ordNamespace: "sap.test",
    appName: "TestApp",
};

describe("RESOLVERS.title", () => {
    it("strips namespace segments and 'Service' suffix", () => {
        expect(RESOLVERS.title(BASE_SERVICE)).toBe("BusinessPartner Service");
    });

    it("works for a plain service name without dots", () => {
        expect(RESOLVERS.title({ name: "OrderService" })).toBe("Order Service");
    });

    it("strips 'Service' suffix followed by extra characters", () => {
        expect(RESOLVERS.title({ name: "OrderServiceV2" })).toBe("Order Service");
    });

    it("returns the name as-is (last segment) when it does not end with 'Service'", () => {
        expect(RESOLVERS.title({ name: "sap.test.Orders" })).toBe("Orders Service");
    });

    it("prefers @ORD.Extensions.title when set", () => {
        const service = { ...BASE_SERVICE, "@ORD.Extensions.title": "Custom Title" };
        expect(RESOLVERS.title(service)).toBe("Custom Title");
    });
});

describe("RESOLVERS.groupId", () => {
    it("builds groupId from groupTypeId, namespace, and service name", () => {
        expect(RESOLVERS.groupId(BASE_SERVICE, BASE_APP_CONFIG)).toBe(
            `${defaults.groupTypeId}:sap.test:BusinessPartnerService`,
        );
    });

    it("strips the ordNamespace prefix from the service name", () => {
        const service = { name: "sap.test.BusinessPartnerService" };
        expect(RESOLVERS.groupId(service, BASE_APP_CONFIG)).toBe(
            `${defaults.groupTypeId}:sap.test:BusinessPartnerService`,
        );
    });

    it("uses the full service name when it does not match any namespace", () => {
        const service = { name: "com.external.SomeService" };
        expect(RESOLVERS.groupId(service, BASE_APP_CONFIG)).toBe(
            `${defaults.groupTypeId}:sap.test:com.external.SomeService`,
        );
    });

    it("uses internalNamespace prefix when it matches service name", () => {
        const appConfig = { ...BASE_APP_CONFIG, internalNamespace: "sap.internal" };
        const service = { name: "sap.internal.MyService" };
        expect(RESOLVERS.groupId(service, appConfig)).toBe(`${defaults.groupTypeId}:sap.test:MyService`);
    });
});

describe("createGroupsTemplateForService", () => {
    let serviceDefinition;
    const appConfig = {
        ordNamespace: "customer.testNamespace",
        appName: "testAppName",
        lastUpdate: "2022-12-19T15:47:04+00:00",
        policyLevels: ["none"],
        authConfig: {
            accessStrategies: [ORD_ACCESS_STRATEGY.Open],
        },
    };

    beforeAll(() => {
        const model = cds.linked(`
                service testServiceName {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                };
            `);
        serviceDefinition = model.definitions["testServiceName"];
    });

    it("produces a complete group object with defaults", () => {
        const result = createGroupsTemplateForService(BASE_SERVICE, BASE_APP_CONFIG);
        expect(result).toEqual({
            groupTypeId: defaults.groupTypeId,
            title: "BusinessPartner Service",
            groupId: `${defaults.groupTypeId}:sap.test:BusinessPartnerService`,
        });
    });

    it("uses @ORD.Extensions.title when set", () => {
        const service = { ...BASE_SERVICE, "@ORD.Extensions.title": "My Group" };
        const result = createGroupsTemplateForService(service, BASE_APP_CONFIG);
        expect(result.title).toBe("My Group");
    });

    it("always uses the canonical groupTypeId from defaults", () => {
        const result = createGroupsTemplateForService(BASE_SERVICE, BASE_APP_CONFIG);
        expect(result.groupTypeId).toBe(defaults.groupTypeId);
    });

    it("should return default value when groupIds do not have groupId", () => {
        expect(createGroupsTemplateForService(serviceDefinition, appConfig)).toEqual({
            groupId: "sap.cds:service:customer.testNamespace:testServiceName",
            groupTypeId: "sap.cds:service",
            title: "test Service",
        });
    });

    it('should return default value with a proper Service title when "Service" keyword is missing', () => {
        expect(createGroupsTemplateForService({ ...serviceDefinition, name: "testServName" }, appConfig)).toEqual({
            groupId: "sap.cds:service:customer.testNamespace:testServName",
            groupTypeId: "sap.cds:service",
            title: "testServName Service",
        });
    });
});
