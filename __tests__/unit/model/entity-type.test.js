const { createEntityTypes, hasSAPPolicyLevel } = require("../../../lib/model/entity-type");

describe("entity-type", () => {
    const baseConfig = {
        ordNamespace: "customer.app",
        lastUpdate: "2024-11-04T14:33:25+01:00",
        policyLevels: ["none"],
    };

    const packageIds = ["customer.app:package:test-entityType:v1", "customer.app:package:test-api:v1"];

    describe("createEntityTypes", () => {
        test("creates entity type from entity with ordId", () => {
            const entities = [
                {
                    "ordId": "customer.app:entityType:Order:v1",
                    "entityName": "Order",
                    "@ODM.root": true,
                },
            ];
            const result = createEntityTypes(entities, baseConfig, packageIds);
            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("customer.app:entityType:Order:v1");
            expect(result[0].localId).toBe("Order");
            expect(result[0].level).toBe("root-entity");
            expect(result[0].version).toBe("1.0.0");
        });

        test("returns sub-entity when no root annotation", () => {
            const entities = [
                {
                    ordId: "customer.app:entityType:LineItem:v1",
                    entityName: "LineItem",
                },
            ];
            const result = createEntityTypes(entities, baseConfig, packageIds);
            expect(result[0].level).toBe("sub-entity");
        });

        test("skips entities with isODMMapping flag", () => {
            const entities = [
                {
                    ordId: "customer.app:entityType:Mapped:v1",
                    entityName: "Mapped",
                    isODMMapping: true,
                },
            ];
            expect(createEntityTypes(entities, baseConfig, packageIds)).toHaveLength(0);
        });

        test("skips private entities", () => {
            const entities = [
                {
                    "ordId": "customer.app:entityType:Secret:v1",
                    "entityName": "Secret",
                    "@ORD.Extensions.visibility": "private",
                },
            ];
            expect(createEntityTypes(entities, baseConfig, packageIds)).toHaveLength(0);
        });

        test("returns empty when SAP policy level is set", () => {
            const sapConfig = { ...baseConfig, policyLevels: ["sap:core:v1"] };
            const entities = [{ ordId: "ns:entityType:X:v1", entityName: "X" }];
            expect(createEntityTypes(entities, sapConfig, packageIds)).toHaveLength(0);
        });

        test("returns empty for null/empty entities", () => {
            expect(createEntityTypes(null, baseConfig, packageIds)).toHaveLength(0);
            expect(createEntityTypes([], baseConfig, packageIds)).toHaveLength(0);
        });

        test("uses @title annotation for title", () => {
            const entities = [
                {
                    "ordId": "customer.app:entityType:Product:v1",
                    "entityName": "Product",
                    "@title": "Custom Product Title",
                },
            ];
            const result = createEntityTypes(entities, baseConfig, packageIds);
            expect(result[0].title).toBe("Custom Product Title");
        });
    });

    describe("hasSAPPolicyLevel", () => {
        test("true when any policy level starts with sap", () => {
            expect(hasSAPPolicyLevel(["sap:core:v1"])).toBe(true);
            expect(hasSAPPolicyLevel(["none", "sap:partner:v1"])).toBe(true);
        });

        test("false when no SAP policy level", () => {
            expect(hasSAPPolicyLevel(["none"])).toBe(false);
            expect(hasSAPPolicyLevel(["customer:level:v1"])).toBe(false);
        });

        test("case insensitive SAP prefix", () => {
            expect(hasSAPPolicyLevel(["SAP:core:v1"])).toBe(true);
        });
    });
});
