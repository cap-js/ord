const { createEntityTypeTemplate } = require("../../lib/templates/entity-type");
const { createAPIResourceTemplate, createEventResourceTemplate, _getPackageID } = require("../../lib/templates");

describe("templates", () => {
    const appConfig = {
        ordNamespace: "customer.testNamespace",
        appName: "testAppName",
        lastUpdate: "2022-12-19T15:47:04+00:00",
        policyLevels: ["none"],
    };

    describe("createEntityTypeTemplate", () => {
        const packageIds = [
            "sap.test.cdsrc.sample:package:test-entityType:v1",
            "sap.test.cdsrc.sample:package:test-entityType-internal:v1",
        ];

        it("should keep EntityType visibility independent of private API references", () => {
            const entity = {
                "@EntityRelationship.entityType": "sap.sm:PrivateEntity:v1",
            };

            const updatedAppConfig = {
                ...appConfig,
                apiResources: [
                    {
                        ordId: "sap.sm:apiResource:SomeAPI:v1",
                        visibility: "private",
                        exposedEntityTypes: [{ ordId: entity.ordId }],
                    },
                ],
            };

            const entityType = createEntityTypeTemplate(updatedAppConfig, entity);

            expect(entityType).not.toBeNull();
            expect(entityType.visibility).toBe("public");
        });

        it("should assign the correct partOfPackage based on visibility", () => {
            const entity = {
                "@EntityRelationship.entityType": "sap.sm:PublicEntity:v1",
                "@ORD.Extensions.visibility": "public",
            };

            const updatedAppConfig = { ...appConfig };

            const entityType = createEntityTypeTemplate(updatedAppConfig, entity);

            expect(entityType).not.toBeNull();
            expect(entityType.partOfPackage).toBe("customer.testNamespace:package:testAppName:v1");
        });

        it("should assign the correct partOfPackage for a non-public entity (e.g., internal)", () => {
            const entity = {
                "@EntityRelationship.entityType": "sap.sm:InternalEntity:v1",
                "@ORD.Extensions.visibility": "internal",
            };

            const updatedAppConfig = { ...appConfig };

            const entityType = createEntityTypeTemplate(updatedAppConfig, entity);

            expect(entityType).not.toBeNull();
            expect(entityType.partOfPackage).toBe("customer.testNamespace:package:testAppName-internal:v1");
        });
    });

    describe("createAPIResourceTemplate", () => {
        const packageIds = [
            "sap.test.cdsrc.sample:package:test-api:v1",
            "sap.test.cdsrc.sample:package:test-api-private:v1",
            "sap.test.cdsrc.sample:package:test-api-internal:v1",
        ];

        it("should assign the correct partOfPackage for public API", () => {
            const serviceDefinition = {
                "@ORD.Extensions.visibility": "public",
                "entities": [],
                "name": "PublicAPI",
                "kind": "service",
            };

            const apiResource = createAPIResourceTemplate(serviceDefinition, appConfig, packageIds, {});

            expect(apiResource).not.toBeNull();
            expect(apiResource[0].partOfPackage).toBe("sap.test.cdsrc.sample:package:test-api:v1");
        });

        it("should assign the correct partOfPackage for internal API", () => {
            const serviceDefinition = {
                "@ORD.Extensions.visibility": "internal",
                "entities": [],
                "name": "InternalAPI",
                "kind": "service",
            };

            const apiResource = createAPIResourceTemplate(serviceDefinition, appConfig, packageIds, {});

            expect(apiResource).not.toBeNull();
            expect(apiResource[0].partOfPackage).toBe("sap.test.cdsrc.sample:package:test-api-internal:v1");
        });

        it("should return null for private API", () => {
            const serviceDefinition = { "@ORD.Extensions.visibility": "private", "entities": [], "name": "PrivateAPI" };

            const apiResource = createAPIResourceTemplate(serviceDefinition, appConfig, packageIds, {});

            expect(apiResource).toHaveLength(0);
        });
    });

    describe("createEventResourceTemplate", () => {
        const packageIds = [
            "sap.test.cdsrc.sample:package:test-event:v1",
            "sap.test.cdsrc.sample:package:test-event-private:v1",
            "sap.test.cdsrc.sample:package:test-event-internal:v1",
        ];

        it("should assign the correct partOfPackage for public Event", () => {
            const serviceDefinition = { "@ORD.Extensions.visibility": "public", "entities": [], "name": "PublicEvent" };

            const eventResource = createEventResourceTemplate(serviceDefinition, appConfig, packageIds, {});

            expect(eventResource).not.toHaveLength(0);
            expect(eventResource[0].partOfPackage).toBe("sap.test.cdsrc.sample:package:test-event:v1");
        });

        it("should assign the correct partOfPackage for internal Event", () => {
            const serviceDefinition = {
                "@ORD.Extensions.visibility": "internal",
                "entities": [],
                "name": "InternalEvent",
            };

            const eventResource = createEventResourceTemplate(serviceDefinition, appConfig, packageIds, {});

            expect(eventResource).not.toHaveLength(0);
            expect(eventResource[0].partOfPackage).toBe("sap.test.cdsrc.sample:package:test-event-internal:v1");
        });

        it("should return an empty array for private Event", () => {
            const serviceDefinition = {
                "@ORD.Extensions.visibility": "private",
                "entities": [],
                "name": "PrivateEvent",
            };

            const eventResource = createEventResourceTemplate(serviceDefinition, appConfig, packageIds, {});

            expect(eventResource).toHaveLength(0);
        });
    });
    describe("_getPackageID", () => {
        const packageIds = [
            "sap.test:package:test-entityType-public:v1",
            "sap.test:package:test-api-xyz:v1",
            "customer.testNamespace:package:fallback-package:v1",
        ];

        it("should use visibility-specific logic when resourceType is provided", () => {
            const result = _getPackageID("customer.testNamespace", packageIds, "entityType", "public");
            expect(result).toBe("sap.test:package:test-entityType-public:v1");
        });

        it("should use simple pattern when no visibility is specified", () => {
            const result = _getPackageID(
                "customer.testNamespace",
                ["sap.test:package:test-simple-entityType-match:v1"],
                "entityType",
            );
            expect(result).toBe("sap.test:package:test-simple-entityType-match:v1");
        });

        it("should use namespace fallback when no resourceType is provided", () => {
            const result = _getPackageID("customer.testNamespace", packageIds);
            expect(result).toBe("customer.testNamespace:package:fallback-package:v1");
        });

        it("should return undefined when no packageIds are provided", () => {
            const result = _getPackageID("customer.testNamespace");
            expect(result).toBeUndefined();
        });
    });
});
