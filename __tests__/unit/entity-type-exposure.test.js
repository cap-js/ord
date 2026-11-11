const cds = require("@sap/cds");
const ord = require("../../lib/ord");
cds.build = require("@sap/cds-dk/lib/build");
const OrdBuildPlugin = require("../../lib/build");
const { createEntityTypes } = require("../../lib/templates/entity-type");
const { resolveODMEntityTypeOrdId } = require("../../lib/common/entity-types");

const source = `
    namespace demo;
    @ObjectModel.compositionRoot: true
    @EntityRelationship.entityType: 'customer.demo:Order:v2'
    @ODM.entityName: 'sap.odm:Order:v1'
    @ORD.Extensions.ordId: '{namespace}:{type}:CustomOrder:v2'
    entity Orders {
        key ID: UUID;
        items: Composition of many Items on items.parent = $self;
    }
    @EntityRelationship.entityType: 'customer.demo:OrderItem:v2'
    entity Items {
        key ID: UUID;
        parent: Association to Orders;
        currency: Association to Currency;
        details: Composition of many Details on details.parent = $self;
    }
    @EntityRelationship.entityType: 'customer.demo:OrderItemDetail:v2'
    entity Details { key ID: UUID; parent: Association to Items; }
    @EntityRelationship.entityType: 'customer.demo:Currency'
    entity Currency { key ID: UUID; }
    service OrderService {
        entity Orders as projection on demo.Orders;
        event Changed { ID: UUID; }
    }
`;

describe("entity type exposure", () => {
    let originalEnv;
    let model;
    beforeEach(() => {
        originalEnv = cds.env.ord;
        cds.env.ord = {
            namespace: "customer.demo",
            policyLevels: ["none"],
            entityTypes: { generateAggregates: true },
        };
        model = cds.compile(source);
    });
    afterEach(() => {
        cds.env.ord = originalEnv;
    });

    const find = (document, name) => document.entityTypes.find((entity) => entity.ordId.includes(`:${name}:`));

    it("generates aggregate membership from nested compositions, without treating associations as membership", () => {
        const document = ord(model);
        expect(find(document, "CustomOrder").level).toBe("aggregate");
        expect(document.entityTypes).toHaveLength(4);
        for (const name of ["OrderItem", "OrderItemDetail"]) {
            expect(find(document, name).relatedEntityTypes).toEqual([
                { ordId: "customer.demo:entityType:CustomOrder:v2", relationType: "part-of" },
            ]);
        }
        expect(find(document, "Currency").relatedEntityTypes).toBeUndefined();
        expect(find(document, "CustomOrder").relatedEntityTypes).toEqual([
            { ordId: "sap.odm:entityType:Order:v1", relationType: "can-share-identity" },
        ]);
    });

    it("uses the same resolved identities in definitions and API/event references", () => {
        const document = ord(model);
        const expected = [
            { ordId: "sap.odm:entityType:Order:v1" },
            { ordId: "customer.demo:entityType:CustomOrder:v2" },
            { ordId: "customer.demo:entityType:OrderItem:v2" },
            { ordId: "customer.demo:entityType:Currency:v1" },
            { ordId: "customer.demo:entityType:OrderItemDetail:v2" },
        ];
        expect(document.apiResources[0].exposedEntityTypes).toEqual(expected);
        expect(document.eventResources[0].exposedEntityTypes).toEqual(expected);
        for (const { ordId } of expected.slice(1)) {
            expect(document.entityTypes.some((entity) => entity.ordId === ordId)).toBe(true);
        }
    });

    it("keeps legacy root IDs and levels when aggregate generation is disabled", () => {
        delete cds.env.ord.entityTypes;
        const document = ord(model);
        expect(find(document, "CustomOrder").level).toBe("root-entity");
        expect(find(document, "OrderItem").relatedEntityTypes).toBeUndefined();
        expect(document.apiResources[0].exposedEntityTypes).toEqual(document.eventResources[0].exposedEntityTypes);
    });

    it("optionally adds a separate Root identity and references it from APIs/events", () => {
        cds.env.ord.entityTypes.includeRootEntities = true;
        const document = ord(model);
        const rootId = "customer.demo:entityType:CustomOrderRoot:v2";
        expect(document.entityTypes).toHaveLength(5);
        expect(find(document, "CustomOrderRoot")).toMatchObject({
            ordId: rootId,
            localId: "OrderRoot",
            level: "root-entity",
            relatedEntityTypes: [
                { ordId: "customer.demo:entityType:CustomOrder:v2", relationType: "part-of" },
                { ordId: "sap.odm:entityType:Order:v1", relationType: "can-share-identity" },
            ],
        });
        expect(document.apiResources[0].exposedEntityTypes).toContainEqual({ ordId: rootId });
        expect(document.eventResources[0].exposedEntityTypes).toContainEqual({ ordId: rootId });
    });

    it("preserves explicit level and exposure overrides", () => {
        model.definitions["demo.Orders"]["@ORD.Extensions.level"] = "root-entity";
        model.definitions["demo.OrderService.Orders"]["@ORD.Extensions.level"] = "root-entity";
        model.definitions["demo.OrderService"]["@ORD.Extensions.exposedEntityTypes"] = [
            { ordId: "sap.odm:entityType:Order:v1" },
        ];
        const document = ord(model);
        expect(find(document, "CustomOrder").level).toBe("root-entity");
        expect(document.apiResources[0].exposedEntityTypes).toEqual([{ ordId: "sap.odm:entityType:Order:v1" }]);
        expect(document.eventResources[0].exposedEntityTypes).toEqual([{ ordId: "sap.odm:entityType:Order:v1" }]);
    });

    it("merges inferred relationships without changing explicit relationships or the source model", () => {
        const relationships = [{ ordId: "customer.demo:entityType:Other:v1", relationType: "custom" }];
        model.definitions["demo.Items"]["@ORD.Extensions.relatedEntityTypes"] = relationships;
        const document = ord(model);
        expect(find(document, "OrderItem").relatedEntityTypes).toEqual([
            ...relationships,
            { ordId: "customer.demo:entityType:CustomOrder:v2", relationType: "part-of" },
        ]);
        expect(relationships).toHaveLength(1);
        expect(ord(model).entityTypes.map((entity) => entity.relatedEntityTypes)).toEqual(
            document.entityTypes.map((entity) => entity.relatedEntityTypes),
        );
    });

    it("filters private definitions from aggregate relationships", () => {
        model.definitions["demo.Details"]["@ORD.Extensions.visibility"] = "private";
        const document = ord(model);
        expect(find(document, "OrderItemDetail")).toBeUndefined();
        expect(document.entityTypes).toHaveLength(3);
        for (const resource of [...document.apiResources, ...document.eventResources]) {
            expect(resource.exposedEntityTypes).not.toContainEqual({ ordId: "customer.demo:entityType:OrderItemDetail:v2" });
        }
    });

    it("keeps SAP publication through the central registry even when aggregate generation is enabled", () => {
        cds.env.ord.policyLevels = ["sap:core:v1"];
        cds.env.ord.entityTypes.includeRootEntities = true;
        const document = ord(model);
        expect(document.entityTypes).toBeUndefined();
        expect(document.apiResources[0].exposedEntityTypes).toContainEqual({ ordId: "sap.odm:entityType:Order:v1" });
        expect(document.apiResources[0].exposedEntityTypes).toContainEqual({ ordId: "customer.demo:entityType:CustomOrder:v2" });
        expect(document.eventResources[0].exposedEntityTypes).toContainEqual({ ordId: "sap.odm:entityType:Order:v1" });
        expect(document.eventResources[0].exposedEntityTypes).toContainEqual({ ordId: "customer.demo:entityType:CustomOrder:v2" });
    });

    it("preserves entity relationships in static system-version output", () => {
        const document = ord(model);
        const built = OrdBuildPlugin.prototype._postProcess.call(OrdBuildPlugin.prototype, document);
        expect(built.perspective).toBe("system-version");
        expect(built.entityTypes).toEqual(document.entityTypes);
        expect(built.apiResources[0].exposedEntityTypes).toEqual(document.apiResources[0].exposedEntityTypes);
        expect(built.apiResources[0].resourceDefinitions[0].url).not.toContain("/ord/v1/");
    });

    it("rejects collisions between generated Root IDs and explicitly named entity types", () => {
        cds.env.ord.entityTypes.includeRootEntities = true;
        model.definitions["demo.Currency"]["@EntityRelationship.entityType"] = "customer.demo:CustomOrderRoot:v2";
        expect(() => ord(model)).toThrow("Generated root entity type ID collides");
    });

    it("rejects conflicting levels for the same entity type ID", () => {
        model.definitions["demo.OrderService.Orders"]["@ORD.Extensions.level"] = "root-entity";
        expect(() => ord(model)).toThrow("Conflicting entity type levels");
    });

    it("terminates composition cycles and avoids self-relationships", () => {
        const entity = {
            name: "Order",
            kind: "entity",
            "@EntityRelationship.entityType": "customer.demo:Order:v1",
            "@ODM.root": true,
        };
        entity.compositions = { self: { _target: entity } };
        const result = createEntityTypes({
            env: cds.env.ord,
            ordNamespace: "customer.demo",
            appName: "demo",
            packageName: "demo",
            csn: { definitions: { Order: entity } },
        });
        expect(result).toHaveLength(1);
        expect(result[0].relatedEntityTypes).toBeUndefined();
    });
});

describe("ODM entity type identities", () => {
    it.each([
        ["Order", "sap.odm:entityType:Order:v1"],
        ["odm.bookshop.Authors", "sap.odm:entityType:odm.bookshop.Authors:v1"],
        ["sap.odm:Order", "sap.odm:entityType:Order:v1"],
        ["sap.odm:Order:v2", "sap.odm:entityType:Order:v2"],
        ["sap.odm:entityType:Order:v2", "sap.odm:entityType:Order:v2"],
    ])("converts %s to %s", (name, expected) => {
        expect(resolveODMEntityTypeOrdId({ "@ODM.entityName": name })).toBe(expected);
    });
});
