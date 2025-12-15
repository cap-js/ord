const cds = require("@sap/cds");
const { mockCdsContext } = require("./utils/test-helpers");

// Mock CDS context with open authentication
mockCdsContext(cds);
const {
    createEntityTypeTemplate,
    createAPIResourceTemplate,
    createEventResourceTemplate,
    _getPackageID,
} = require("../../lib/templates");

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
                ordId: "sap.sm:entityType:PrivateEntity:v1",
                entityName: "PrivateEntity",
            };

            const updatedAppConfig = {
                ...appConfig,
                apiResources: [
                    {
                        ordId: "sap.sm:apiResource:SomeAPI:v1",
                        visibility: "private",
                        entityTypeMappings: [{ entityTypeTargets: [{ ordId: entity.ordId }] }],
                    },
                ],
            };

            const entityType = createEntityTypeTemplate(updatedAppConfig, packageIds, entity);

            expect(entityType).not.toBeNull();
            expect(entityType.visibility).toBe("public");
        });

        it("should return null if EntityType has visibility set to private", () => {
            const entity = {
                "ordId": "sap.sm:entityType:PrivateEntity:v1",
                "entityName": "PrivateEntity",
                "@ORD.Extensions.visibility": "private",
            };

            const updatedAppConfig = {
                ...appConfig,
                apiResources: [
                    {
                        ordId: "sap.sm:apiResource:SomeAPI:v1",
                        visibility: "public",
                        entityTypeMappings: [{ entityTypeTargets: [{ ordId: entity.ordId }] }],
                    },
                ],
            };

            const entityType = createEntityTypeTemplate(updatedAppConfig, packageIds, entity);

            expect(entityType).toEqual([]);
        });

        it("should assign the correct partOfPackage based on visibility", () => {
            const entity = {
                "ordId": "sap.sm:entityType:PublicEntity:v1",
                "entityName": "PublicEntity",
                "@ORD.Extensions.visibility": "public",
            };

            const updatedAppConfig = { ...appConfig };

            const entityType = createEntityTypeTemplate(updatedAppConfig, packageIds, entity);

            expect(entityType).not.toBeNull();
            expect(entityType.partOfPackage).toBe("sap.test.cdsrc.sample:package:test-entityType:v1");
        });

        it("should assign the correct partOfPackage for a non-public entity (e.g., internal)", () => {
            const entity = {
                "ordId": "sap.sm:entityType:InternalEntity:v1",
                "entityName": "InternalEntity",
                "@ORD.Extensions.visibility": "internal",
            };

            const updatedAppConfig = { ...appConfig };

            const entityType = createEntityTypeTemplate(updatedAppConfig, packageIds, entity);

            expect(entityType).not.toBeNull();
            expect(entityType.partOfPackage).toBe("sap.test.cdsrc.sample:package:test-entityType-internal:v1");
        });
    });

    describe("createAPIResourceTemplate", () => {
        const packageIds = [
            "sap.test.cdsrc.sample:package:test-api:v1",
            "sap.test.cdsrc.sample:package:test-api-private:v1",
            "sap.test.cdsrc.sample:package:test-api-internal:v1",
        ];

        it("should assign the correct partOfPackage for public API", () => {
            const serviceName = "PublicAPI";
            const serviceDefinition = { "@ORD.Extensions.visibility": "public", "entities": [], "name": serviceName };

            const apiResource = createAPIResourceTemplate(serviceName, serviceDefinition, appConfig, packageIds, {});

            expect(apiResource).not.toBeNull();
            expect(apiResource[0].partOfPackage).toBe("sap.test.cdsrc.sample:package:test-api:v1");
        });

        it("should assign the correct partOfPackage for internal API", () => {
            const serviceName = "InternalAPI";
            const serviceDefinition = { "@ORD.Extensions.visibility": "internal", "entities": [], "name": serviceName };

            const apiResource = createAPIResourceTemplate(serviceName, serviceDefinition, appConfig, packageIds, {});

            expect(apiResource).not.toBeNull();
            expect(apiResource[0].partOfPackage).toBe("sap.test.cdsrc.sample:package:test-api-internal:v1");
        });

        it("should return null for private API", () => {
            const serviceName = "PrivateAPI";
            const serviceDefinition = { "@ORD.Extensions.visibility": "private", "entities": [], "name": serviceName };

            const apiResource = createAPIResourceTemplate(serviceName, serviceDefinition, appConfig, packageIds, {});

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
            const serviceName = "PublicEvent";
            const serviceDefinition = { "@ORD.Extensions.visibility": "public", "entities": [], "name": serviceName };

            const eventResource = createEventResourceTemplate(
                serviceName,
                serviceDefinition,
                appConfig,
                packageIds,
                {},
            );

            expect(eventResource).not.toHaveLength(0);
            expect(eventResource[0].partOfPackage).toBe("sap.test.cdsrc.sample:package:test-event:v1");
        });

        it("should assign the correct partOfPackage for internal Event", () => {
            const serviceName = "InternalEvent";
            const serviceDefinition = { "@ORD.Extensions.visibility": "internal", "entities": [], "name": serviceName };

            const eventResource = createEventResourceTemplate(
                serviceName,
                serviceDefinition,
                appConfig,
                packageIds,
                {},
            );

            expect(eventResource).not.toHaveLength(0);
            expect(eventResource[0].partOfPackage).toBe("sap.test.cdsrc.sample:package:test-event-internal:v1");
        });

        it("should return an empty array for private Event", () => {
            const serviceName = "PrivateEvent";
            const serviceDefinition = { "@ORD.Extensions.visibility": "private", "entities": [], "name": serviceName };

            const eventResource = createEventResourceTemplate(
                serviceName,
                serviceDefinition,
                appConfig,
                packageIds,
                {},
            );

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
