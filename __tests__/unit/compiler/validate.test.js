describe("validate", () => {
    const { validate } = require("../../../lib/compiler/validate");

    test("passes when all ordIds are unique", () => {
        const document = {
            resolved: {
                apiResources: [{ ordId: "ns:apiResource:A:v1" }, { ordId: "ns:apiResource:B:v1" }],
                eventResources: [{ ordId: "ns:eventResource:A:v1" }],
                entityTypes: [{ ordId: "ns:entityType:Order:v1" }],
                integrationDependencies: [{ ordId: "ns:integrationDependency:Ext:v1" }],
            },
        };
        expect(() => validate(document)).not.toThrow();
    });

    test("throws on duplicate ordIds within apiResources", () => {
        const document = {
            resolved: {
                apiResources: [{ ordId: "ns:apiResource:Svc:v1" }, { ordId: "ns:apiResource:Svc:v1" }],
                eventResources: [],
                entityTypes: [],
                integrationDependencies: [],
            },
        };
        expect(() => validate(document)).toThrow("Duplicate ordId");
        expect(() => validate(document)).toThrow("ns:apiResource:Svc:v1");
    });

    test("throws on duplicate ordIds across resource types", () => {
        const document = {
            resolved: {
                apiResources: [{ ordId: "ns:resource:Same:v1" }],
                eventResources: [{ ordId: "ns:resource:Same:v1" }],
                entityTypes: [],
                integrationDependencies: [],
            },
        };
        expect(() => validate(document)).toThrow("Duplicate ordId");
    });

    test("skips resources without ordId", () => {
        const document = {
            resolved: {
                apiResources: [{ ordId: "ns:apiResource:A:v1" }, {}],
                eventResources: [],
                entityTypes: [],
                integrationDependencies: [],
            },
        };
        expect(() => validate(document)).not.toThrow();
    });

    test("passes for empty resources", () => {
        const document = {
            resolved: {
                apiResources: [],
                eventResources: [],
                entityTypes: [],
                integrationDependencies: [],
            },
        };
        expect(() => validate(document)).not.toThrow();
    });
});
