const { createGroup } = require("../../../lib/model/group");

describe("group", () => {
    const baseConfig = { ordNamespace: "customer.app", env: {} };

    describe("createGroup", () => {
        test("creates group with groupId and title from extension", () => {
            const service = {
                name: "customer.app.CatalogService",
                definition: { name: "customer.app.CatalogService" },
                extensions: { title: "Product Catalog" },
            };
            const group = createGroup(service, baseConfig);
            expect(group.title).toBe("Product Catalog");
            expect(group.groupId).toContain("CatalogService");
            expect(group.groupTypeId).toBeDefined();
        });

        test("derives title from service name when no extension title", () => {
            const service = {
                name: "customer.app.CatalogService",
                definition: { name: "customer.app.CatalogService" },
                extensions: {},
            };
            const group = createGroup(service, baseConfig);
            expect(group.title).toBe("Catalog Service");
        });

        test("appends Service to title when service name has no Service suffix", () => {
            const service = {
                name: "customer.app.Inventory",
                definition: { name: "customer.app.Inventory" },
                extensions: {},
            };
            const group = createGroup(service, baseConfig);
            expect(group.title).toBe("Inventory Service");
        });

        test("returns null for private services", () => {
            const service = {
                name: "customer.app.InternalService",
                definition: { name: "customer.app.InternalService" },
                extensions: { visibility: "private" },
            };
            expect(createGroup(service, baseConfig)).toBeNull();
        });
    });
});
