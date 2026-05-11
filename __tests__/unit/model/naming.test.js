const { stripNamespacePrefix, startsWithNamespace, buildGroupId, findPackageId } = require("../../../lib/model/naming");

describe("naming", () => {
    describe("stripNamespacePrefix", () => {
        test("strips ordNamespace prefix", () => {
            const service = { definition: { name: "customer.app.CatalogService" } };
            const config = { ordNamespace: "customer.app" };
            expect(stripNamespacePrefix(service, config)).toBe("CatalogService");
        });

        test("strips internalNamespace when it matches (priority over ordNamespace)", () => {
            const service = { definition: { name: "sap.internal.CatalogService" } };
            const config = { ordNamespace: "customer.app", internalNamespace: "sap.internal" };
            expect(stripNamespacePrefix(service, config)).toBe("CatalogService");
        });

        test("returns full name when no namespace matches", () => {
            const service = { definition: { name: "OtherService" } };
            const config = { ordNamespace: "customer.app" };
            expect(stripNamespacePrefix(service, config)).toBe("OtherService");
        });

        test("handles dotted service names after namespace", () => {
            const service = { definition: { name: "customer.app.sub.DeepService" } };
            const config = { ordNamespace: "customer.app" };
            expect(stripNamespacePrefix(service, config)).toBe("sub.DeepService");
        });

        test("does not strip partial namespace match", () => {
            const service = { definition: { name: "customer.application.Svc" } };
            const config = { ordNamespace: "customer.app" };
            expect(stripNamespacePrefix(service, config)).toBe("customer.application.Svc");
        });
    });

    describe("startsWithNamespace", () => {
        test("true when name equals namespace exactly", () => {
            expect(startsWithNamespace("customer.app", "customer.app")).toBe(true);
        });

        test("true when name starts with namespace followed by dot", () => {
            expect(startsWithNamespace("customer.app.Svc", "customer.app")).toBe(true);
        });

        test("false when namespace is only a prefix of a segment", () => {
            expect(startsWithNamespace("customer.application.Svc", "customer.app")).toBe(false);
        });

        test("false when name does not start with namespace", () => {
            expect(startsWithNamespace("other.Svc", "customer.app")).toBe(false);
        });
    });

    describe("buildGroupId", () => {
        test("constructs groupId from groupTypeId + namespace + local name", () => {
            const service = { definition: { name: "customer.app.CatalogService" } };
            const config = { ordNamespace: "customer.app" };
            const groupId = buildGroupId(service, config);
            expect(groupId).toMatch(/^sap\.cds:service:.+:CatalogService$/);
        });
    });

    describe("findPackageId", () => {
        const packageIds = [
            "ns:package:test-api:v1",
            "ns:package:test-api-internal:v1",
            "ns:package:test-event:v1",
            "ns:package:test-entityType:v1",
        ];

        test("finds public api package (excludes -internal and -private)", () => {
            const result = findPackageId("ns", packageIds, "api", "public");
            expect(result).toBe("ns:package:test-api:v1");
        });

        test("finds internal api package", () => {
            const result = findPackageId("ns", packageIds, "api", "internal");
            expect(result).toBe("ns:package:test-api-internal:v1");
        });

        test("finds event package", () => {
            const result = findPackageId("ns", packageIds, "event", "public");
            expect(result).toBe("ns:package:test-event:v1");
        });

        test("falls back to namespace match when resourceType not found", () => {
            const result = findPackageId("ns", packageIds, "unknown-type", "public");
            expect(result).toBe("ns:package:test-api:v1");
        });

        test("returns undefined when packageIds is falsy", () => {
            expect(findPackageId("ns", null, "api")).toBeUndefined();
        });
    });
});
