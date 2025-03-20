const cds = require('@sap/cds');
const { AUTHENTICATION_TYPE } = require('../../lib/constants');

jest.spyOn(cds, "context", "get").mockReturnValue({
    authConfig: {
        types: [AUTHENTICATION_TYPE.Open]
    }
});
const {
    createEntityTypeTemplate,
    createAPIResourceTemplate,
    createEventResourceTemplate,
    createDataProductTemplate
} = require('../../lib/templates');

describe('templates', () => {
    let linkedModel;

    const appConfig = {
        ordNamespace: 'customer.testNamespace',
        appName: 'testAppName',
        lastUpdate: '2022-12-19T15:47:04+00:00'
    };

    beforeAll(() => {
        linkedModel = cds.linked(`
            namespace customer.testNamespace123;
            entity Books {
                key ID: UUID;
                title: String;
            }
        `);
    });

    describe('createEntityTypeTemplate', () => {
        const packageIds = [
            'sap.test.cdsrc.sample:package:test-entityType-public:v1',
            'sap.test.cdsrc.sample:package:test-entityType-internal:v1'
        ];

        it('should keep EntityType visibility independent of private API references', () => {
            const entity = {
                ordId: "sap.sm:entityType:PrivateEntity:v1",
                entityName: "PrivateEntity",
            };

            const updatedAppConfig = {
                ...appConfig,
                apiResources: [{
                    ordId: "sap.sm:apiResource:SomeAPI:v1",
                    visibility: "private",
                    entityTypeMappings: [{ entityTypeTargets: [{ ordId: entity.ordId }] }]
                }]
            };

            const entityType = createEntityTypeTemplate(updatedAppConfig, packageIds, entity);

            expect(entityType).not.toBeNull();
            expect(entityType.visibility).toBe("public");
        });

        it('should return null if EntityType has visibility set to private', () => {
            const entity = {
                ordId: "sap.sm:entityType:PrivateEntity:v1",
                entityName: "PrivateEntity",
                "@ORD.Extensions.visibility": "private",
            };

            const updatedAppConfig = {
                ...appConfig,
                apiResources: [{
                    ordId: "sap.sm:apiResource:SomeAPI:v1",
                    visibility: "public",
                    entityTypeMappings: [{ entityTypeTargets: [{ ordId: entity.ordId }] }]
                }]
            };

            const entityType = createEntityTypeTemplate(updatedAppConfig, packageIds, entity);

            expect(entityType).toBeNull(); // Should return null for private visibility
        });

        it('should assign the correct partOfPackage based on visibility', () => {
            const entity = {
                ordId: "sap.sm:entityType:PublicEntity:v1",
                entityName: "PublicEntity",
                "@ORD.Extensions.visibility": "public",
            };

            const updatedAppConfig = { ...appConfig };

            const entityType = createEntityTypeTemplate(updatedAppConfig, packageIds, entity);

            expect(entityType).not.toBeNull();
            expect(entityType.partOfPackage).toBe('sap.test.cdsrc.sample:package:test-entityType-public:v1');
        });

        it('should assign the correct partOfPackage for a non-public entity (e.g., internal)', () => {
            const entity = {
                ordId: "sap.sm:entityType:InternalEntity:v1",
                entityName: "InternalEntity",
                "@ORD.Extensions.visibility": "internal",
            };

            const updatedAppConfig = { ...appConfig };

            const entityType = createEntityTypeTemplate(updatedAppConfig, packageIds, entity);

            expect(entityType).not.toBeNull();
            expect(entityType.partOfPackage).toBe('sap.test.cdsrc.sample:package:test-entityType-internal:v1');
        });

    });

    describe('createAPIResourceTemplate', () => {
        const packageIds = [
            'sap.test.cdsrc.sample:package:test-api:v1',
            'sap.test.cdsrc.sample:package:test-api-private:v1',
            'sap.test.cdsrc.sample:package:test-api-internal:v1'
        ];


        it('should remove duplicate referenced entityTypes', () => {
            const serviceName = 'MyService';
            const serviceDefinition = {};
            const expectedOrdId = `${appConfig.ordNamespace}:apiResource:${serviceName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    {
                        entityTypeTargets: [
                            { ordId: `${appConfig.ordNamespace}:entityType:DuplicateEntity:v1` },
                            { ordId: `${appConfig.ordNamespace}:entityType:DuplicateEntity:v1` }
                        ]
                    }
                ]
            };

            const apiResource = createAPIResourceTemplate(serviceName, serviceDefinition, updatedAppConfig, packageIds, {});

            expect(apiResource[0].ordId).toEqual(expectedOrdId)
            expect(apiResource[0].entityTypeMappings[0].entityTypeTargets).toHaveLength(1);
            expect(apiResource[0].entityTypeMappings[0].entityTypeTargets).toEqual([
                { ordId: `${appConfig.ordNamespace}:entityType:DuplicateEntity:v1` }
            ]);
        });
        it('should assign the correct partOfPackage for public API', () => {
            const serviceName = 'PublicAPI';
            const serviceDefinition = { "@ORD.Extensions.visibility": "public" };

            const apiResource = createAPIResourceTemplate(serviceName, serviceDefinition, appConfig, packageIds, {});

            expect(apiResource).not.toBeNull();
            expect(apiResource[0].partOfPackage).toBe('sap.test.cdsrc.sample:package:test-api:v1');
        });

        it('should assign the correct partOfPackage for internal API', () => {
            const serviceName = 'InternalAPI';
            const serviceDefinition = { "@ORD.Extensions.visibility": "internal" };

            const apiResource = createAPIResourceTemplate(serviceName, serviceDefinition, appConfig, packageIds, {});

            expect(apiResource).not.toBeNull();
            expect(apiResource[0].partOfPackage).toBe('sap.test.cdsrc.sample:package:test-api-internal:v1');
        });

        it('should return null for private API', () => {
            const serviceName = 'PrivateAPI';
            const serviceDefinition = { "@ORD.Extensions.visibility": "private" };

            const apiResource = createAPIResourceTemplate(serviceName, serviceDefinition, appConfig, packageIds, {});

            expect(apiResource).toHaveLength(0);
        });
    });

    describe('createEventResourceTemplate', () => {
        const packageIds = [
            'sap.test.cdsrc.sample:package:test-event:v1',
            'sap.test.cdsrc.sample:package:test-event-private:v1',
            'sap.test.cdsrc.sample:package:test-event-internal:v1'
        ];

        it('should remove duplicate referenced entityTypes', () => {
            const serviceName = 'MyService';
            const serviceDefinition = linkedModel;
            const expectedOrdId = `${appConfig.ordNamespace}:eventResource:${serviceName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    {
                        entityTypeTargets: [
                            { ordId: `${appConfig.ordNamespace}:entityType:DuplicateEntity:v1` },
                            { ordId: `${appConfig.ordNamespace}:entityType:DuplicateEntity:v1` }
                        ]
                    }
                ]
            };

            const eventResource = createEventResourceTemplate(serviceName, serviceDefinition, updatedAppConfig, packageIds, {});

            expect(eventResource[0].ordId).toEqual(expectedOrdId);
            expect(eventResource[0].entityTypeMappings[0].entityTypeTargets).toHaveLength(1);
            expect(eventResource[0].entityTypeMappings[0].entityTypeTargets).toEqual([
                { ordId: `${appConfig.ordNamespace}:entityType:DuplicateEntity:v1` }
            ]);
        });

        it('should assign the correct partOfPackage for public Event', () => {
            const serviceName = 'PublicEvent';
            const serviceDefinition = { "@ORD.Extensions.visibility": "public" };

            const eventResource = createEventResourceTemplate(serviceName, serviceDefinition, appConfig, packageIds, {});

            expect(eventResource).not.toHaveLength(0);
            expect(eventResource[0].partOfPackage).toBe('sap.test.cdsrc.sample:package:test-event:v1');
        });

        it('should assign the correct partOfPackage for internal Event', () => {
            const serviceName = 'InternalEvent';
            const serviceDefinition = { "@ORD.Extensions.visibility": "internal" };

            const eventResource = createEventResourceTemplate(serviceName, serviceDefinition, appConfig, packageIds, {});

            expect(eventResource).not.toHaveLength(0);
            expect(eventResource[0].partOfPackage).toBe('sap.test.cdsrc.sample:package:test-event-internal:v1');
        });

        it('should return an empty array for private Event', () => {
            const serviceName = 'PrivateEvent';
            const serviceDefinition = { "@ORD.Extensions.visibility": "private" };

            const eventResource = createEventResourceTemplate(serviceName, serviceDefinition, appConfig, packageIds, {});

            expect(eventResource).toHaveLength(0);
        });
    });

    describe('createDataProductTemplate', () => {
        const packageIds = [
            'sap.test.cdsrc.sample:package:test-dataProduct:v1',
            'sap.test.cdsrc.sample:package:test-dataProduct-private:v1',
            'sap.test.cdsrc.sample:package:test-dataProduct-internal:v1'
        ];

        const appConfig = {
            ordNamespace: 'customer.testNamespace',
            appName: 'testAppName',
            lastUpdate: '2024-03-13',
            entityTypeMappings: []
        };

        it('should remove duplicate referenced entityTypes', () => {
            const dataProductName = 'DuplicateEntityDataProduct';
            const expectedOrdId = `${appConfig.ordNamespace}:dataProduct:${dataProductName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    {
                        entityTypeTargets: [
                            { ordId: `${appConfig.ordNamespace}:entityType:DuplicateEntity:v1` },
                            { ordId: `${appConfig.ordNamespace}:entityType:DuplicateEntity:v1` }
                        ]
                    }
                ]
            };

            const dataProductDefinition = {
                "@title": "Duplicate Entity Data Product",
                "@ORD.Extensions.entityTypes": [
                    { ordId: `${appConfig.ordNamespace}:entityType:DuplicateEntity:v1` }
                ]
            };

            const dataProductTemplate = createDataProductTemplate(dataProductName, dataProductDefinition, updatedAppConfig, packageIds);

            expect(dataProductTemplate[0].ordId).toEqual(expectedOrdId);
            expect(dataProductTemplate[0].entityTypeMappings[0].entityTypeTargets).toHaveLength(1);
            expect(dataProductTemplate[0].entityTypeMappings[0].entityTypeTargets).toEqual([
                { ordId: `${appConfig.ordNamespace}:entityType:DuplicateEntity:v1` }
            ]);
        });

        it('should assign the correct partOfPackage for public Data Product', () => {
            const dataProductName = 'PublicDataProduct';
            const dataProductDefinition = { "@ORD.Extensions.visibility": "public" };

            const dataProductTemplate = createDataProductTemplate(dataProductName, dataProductDefinition, appConfig, packageIds);

            expect(dataProductTemplate).not.toHaveLength(0);
            expect(dataProductTemplate[0].partOfPackage).toBe('sap.test.cdsrc.sample:package:test-dataProduct:v1');
        });

        it('should assign the correct partOfPackage for internal Data Product', () => {
            const dataProductName = 'InternalDataProduct';
            const dataProductDefinition = { "@ORD.Extensions.visibility": "internal" };

            const dataProductTemplate = createDataProductTemplate(dataProductName, dataProductDefinition, appConfig, packageIds);

            expect(dataProductTemplate).not.toHaveLength(0);
            expect(dataProductTemplate[0].partOfPackage).toBe('sap.test.cdsrc.sample:package:test-dataProduct-internal:v1');
        });

        it('should return an empty array for private Data Product', () => {
            const dataProductName = 'PrivateDataProduct';
            const dataProductDefinition = { "@ORD.Extensions.visibility": "private" };

            const dataProductTemplate = createDataProductTemplate(dataProductName, dataProductDefinition, appConfig, packageIds);

            expect(dataProductTemplate).toHaveLength(0);
        });
    });
});
