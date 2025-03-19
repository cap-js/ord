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
            'sap.test.cdsrc.sample:package:test-entityType-private:v1'
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
            expect(entityType.visibility).toBe("public"); // EntityType should remain public despite private API reference
        });

        it('should keep EntityType visibility independent of private DataProduct references', () => {
            const entity = {
                ordId: "sap.sm:entityType:PrivateEntity:v1",
                entityName: "PrivateEntity",
            };

            const updatedAppConfig = {
                ...appConfig,
                dataProducts: [{
                    ordId: "sap.sm:dataProduct:SomeDataProduct:v1",
                    visibility: "private",
                    entityTypes: [entity.ordId]
                }]
            };

            const entityType = createEntityTypeTemplate(updatedAppConfig, packageIds, entity);

            expect(entityType).not.toBeNull();
            expect(entityType.visibility).toBe("public");
        });

        it('should exclude EntityType if referenced by a private Event Resource', () => {
            const entity = {
                ordId: "sap.sm:entityType:PrivateEntity:v1",
                entityName: "PrivateEntity",
                "@ORD.Extensions.visibility": "private",
            };

            const updatedAppConfig = {
                ...appConfig,
                eventResources: [{
                    ordId: "sap.sm:eventResource:SomeEvent:v1",
                    visibility: "private",
                    entityTypeMappings: [{ entityTypeTargets: [{ ordId: entity.ordId }] }]
                }]
            };

            const entityType = createEntityTypeTemplate(updatedAppConfig, packageIds, entity);

            expect(entityType).toBeNull();
        });


    });


    describe('createAPIResourceTemplate', () => {
        const packageIds = [
            'sap.test.cdsrc.sample:package:test-api-public:v1',
            'sap.test.cdsrc.sample:package:test-api-private:v1',
            'sap.test.cdsrc.sample:package:test-api-internal:v1'
        ];

        it('should include all referenced entity types in API resource regardless of namespace', () => {
            const serviceName = 'MyService';
            const serviceDefinition = {};
            const expectedOrdId = `${appConfig.ordNamespace}:apiResource:${serviceName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` }] },
                    { entityTypeTargets: [{ ordId: `external.namespace:entityType:ExternalEntity:v1` }] }
                ]
            };

            const apiResource = createAPIResourceTemplate(serviceName, serviceDefinition, updatedAppConfig, packageIds, {});

            expect(apiResource[0].ordId).toEqual(expectedOrdId);
            expect(apiResource[0].entityTypeMappings).toBeDefined();
            expect(apiResource[0].entityTypeMappings).toHaveLength(1);
            expect(apiResource[0].entityTypeMappings[0].entityTypeTargets).toEqual([
                { ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` },
                { ordId: `external.namespace:entityType:ExternalEntity:v1` }
            ]);
        });


        it('should keep API resource visibility independent of referenced private entityType', () => {
            const serviceName = 'MyService';
            const serviceDefinition = {};
            const expectedOrdId = `${appConfig.ordNamespace}:apiResource:${serviceName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:PrivateEntity:v1`, visibility: "private" }] }
                ]
            };

            const apiResource = createAPIResourceTemplate(serviceName, serviceDefinition, updatedAppConfig, packageIds, {});

            expect(apiResource).not.toEqual([]);
            expect(apiResource[0].ordId).toEqual(expectedOrdId);
            expect(apiResource[0].visibility).toEqual('public');
        });

        it('should keep API resource visibility independent of referenced internal entityType', () => {
            const serviceName = 'MyService';
            const serviceDefinition = {};
            const expectedOrdId = `${appConfig.ordNamespace}:apiResource:${serviceName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:InternalEntity:v1`, visibility: "internal" }] }
                ]
            };

            const apiResource = createAPIResourceTemplate(serviceName, serviceDefinition, updatedAppConfig, packageIds, {});

            expect(apiResource).not.toEqual([]);
            expect(apiResource[0].ordId).toEqual(expectedOrdId);
            expect(apiResource[0].visibility).toEqual('public');
        });


        it('should keep API resource public if no restricted entityTypes are referenced', () => {
            const serviceName = 'MyService';
            const serviceDefinition = {};
            const expectedOrdId = `${appConfig.ordNamespace}:apiResource:${serviceName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:PublicEntity:v1`, visibility: "public" }] }
                ]
            };

            const apiResource = createAPIResourceTemplate(serviceName, serviceDefinition, updatedAppConfig, packageIds, {});

            expect(apiResource[0].ordId).toEqual(expectedOrdId)
            expect(apiResource[0].visibility).toEqual('public');
        });

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
    });

    describe('createEventResourceTemplate', () => {
        const packageIds = [
            'sap.test.cdsrc.sample:package:test-event-public:v1',
            'sap.test.cdsrc.sample:package:test-event-private:v1',
            'sap.test.cdsrc.sample:package:test-event-internal:v1'
        ];

        it('should include all referenced entity types in Event resource regardless of namespace', () => {
            const serviceName = 'MyService';
            const serviceDefinition = linkedModel;
            const expectedOrdId = `${appConfig.ordNamespace}:eventResource:${serviceName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` }] },
                    { entityTypeTargets: [{ ordId: `external.namespace:entityType:ExternalEntity:v1` }] }
                ]
            };

            const eventResource = createEventResourceTemplate(serviceName, serviceDefinition, updatedAppConfig, packageIds, {});

            expect(eventResource).not.toEqual([]);
            expect(eventResource[0].ordId).toEqual(expectedOrdId);
            expect(eventResource[0].entityTypeMappings).toBeDefined();
            expect(eventResource[0].entityTypeMappings).toEqual([
                {
                    entityTypeTargets: [
                        { ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` },
                        { ordId: `external.namespace:entityType:ExternalEntity:v1` }
                    ]
                }
            ]);
        });

        it('should keep Event resource visibility independent of referenced private entityType', () => {
            const serviceName = 'MyService';
            const serviceDefinition = linkedModel;
            const expectedOrdId = `${appConfig.ordNamespace}:eventResource:${serviceName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:PrivateEntity:v1`, visibility: "private" }] }
                ]
            };

            const eventResource = createEventResourceTemplate(serviceName, serviceDefinition, updatedAppConfig, packageIds, {});

            expect(eventResource).not.toEqual([]);
            expect(eventResource[0].ordId).toEqual(expectedOrdId);
            expect(eventResource[0].visibility).toEqual('public'); // Event visibility should not be affected by private entityType
        });


        it('should keep Event resource visibility independent of referenced internal entityType', () => {
            const serviceName = 'MyService';
            const serviceDefinition = linkedModel;
            const expectedOrdId = `${appConfig.ordNamespace}:eventResource:${serviceName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:InternalEntity:v1`, visibility: "internal" }] }
                ]
            };

            const eventResource = createEventResourceTemplate(serviceName, serviceDefinition, updatedAppConfig, packageIds, {});

            expect(eventResource[0].ordId).toEqual(expectedOrdId);
            expect(eventResource[0].visibility).toEqual('public');
        });


        it('should keep Event resource public if no restricted entityTypes are referenced', () => {
            const serviceName = 'MyService';
            const serviceDefinition = linkedModel;
            const expectedOrdId = `${appConfig.ordNamespace}:eventResource:${serviceName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:PublicEntity:v1`, visibility: "public" }] }
                ]
            };

            const eventResource = createEventResourceTemplate(serviceName, serviceDefinition, updatedAppConfig, packageIds, {});

            expect(eventResource[0].ordId).toEqual(expectedOrdId);
            expect(eventResource[0].visibility).toEqual('public');
        });

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
    });

    describe('createDataProductTemplate', () => {
        const packageIds = [
            'sap.test.cdsrc.sample:package:test-dataProduct-public:v1',
            'sap.test.cdsrc.sample:package:test-dataProduct-private:v1',
            'sap.test.cdsrc.sample:package:test-dataProduct-internal:v1'
        ];

        const appConfig = {
            ordNamespace: 'customer.testNamespace',
            appName: 'testAppName',
            lastUpdate: '2024-03-13',
            entityTypeMappings: []
        };

        it('should include all referenced entity types in Data Product regardless of namespace', () => {
            const dataProductName = 'ValidDataProduct';
            const expectedOrdId = `${appConfig.ordNamespace}:dataProduct:${dataProductName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` }] },
                    { entityTypeTargets: [{ ordId: `external.namespace:entityType:ExternalEntity:v1` }] } // Should be included
                ]
            };

            const dataProductDefinition = {
                "@title": "Valid Data Product",
                "@ORD.Extensions.entityTypes": [
                    { ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` },
                    { ordId: `external.namespace:entityType:ExternalEntity:v1` }
                ]
            };

            const dataProductTemplate = createDataProductTemplate(dataProductName, dataProductDefinition, updatedAppConfig, packageIds);

            expect(dataProductTemplate[0].ordId).toEqual(expectedOrdId);
            expect(dataProductTemplate[0].entityTypeMappings).toBeDefined();
            expect(dataProductTemplate[0].entityTypeMappings).toEqual([
                {
                    entityTypeTargets: [
                        { ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` },
                        { ordId: `external.namespace:entityType:ExternalEntity:v1` }
                    ]
                }
            ]);
        });


        it('should keep Data Product visibility independent of referenced private entityType', () => {
            const dataProductName = 'PrivateDataProduct';
            const expectedOrdId = `${appConfig.ordNamespace}:dataProduct:${dataProductName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:PrivateEntity:v1`, visibility: "private" }] }
                ]
            };

            const dataProductDefinition = {
                "@title": "Private Data Product",
                "@ORD.Extensions.entityTypes": [
                    { ordId: `${appConfig.ordNamespace}:entityType:PrivateEntity:v1` }
                ]
            };

            const dataProductTemplate = createDataProductTemplate(dataProductName, dataProductDefinition, updatedAppConfig, packageIds);

            expect(dataProductTemplate).not.toEqual([]);
            expect(dataProductTemplate[0].ordId).toEqual(expectedOrdId);
            expect(dataProductTemplate[0].visibility).toEqual('public'); // Data Product visibility should not be affected by private entityType
        });


        it('should keep Data Product visibility independent of referenced entityType visibility', () => {
            const dataProductName = 'InternalDataProduct';
            const expectedOrdId = `${appConfig.ordNamespace}:dataProduct:${dataProductName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:InternalEntity:v1`, visibility: "internal" }] }
                ]
            };

            const dataProductDefinition = {
                "@title": "Internal Data Product",
                "@ORD.Extensions.entityTypes": [
                    { ordId: `${appConfig.ordNamespace}:entityType:InternalEntity:v1` }
                ]
            };

            const dataProductTemplate = createDataProductTemplate(dataProductName, dataProductDefinition, updatedAppConfig, packageIds);

            expect(dataProductTemplate[0].ordId).toEqual(expectedOrdId);
            expect(dataProductTemplate[0].visibility).toEqual('public');
        });

        it('should keep Data Product public if no restricted entityTypes are referenced', () => {
            const dataProductName = 'PublicDataProduct';
            const expectedOrdId = `${appConfig.ordNamespace}:dataProduct:${dataProductName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:PublicEntity:v1`, visibility: "public" }] }
                ]
            };

            const dataProductDefinition = {
                "@title": "Public Data Product",
                "@ORD.Extensions.entityTypes": [
                    { ordId: `${appConfig.ordNamespace}:entityType:PublicEntity:v1` }
                ]
            };

            const dataProductTemplate = createDataProductTemplate(dataProductName, dataProductDefinition, updatedAppConfig, packageIds);

            expect(dataProductTemplate[0].ordId).toEqual(expectedOrdId);
            expect(dataProductTemplate[0].visibility).toEqual('public');
        });

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
    });
});
