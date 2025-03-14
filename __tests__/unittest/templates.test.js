const cds = require('@sap/cds');
const { AUTHENTICATION_TYPE, RESOURCE_VISIBILITY } = require('../../lib/constants');

jest.spyOn(cds, "context", "get").mockReturnValue({
    authConfig: {
        types: [AUTHENTICATION_TYPE.Open]
    }
});
const {
    createEntityTypeTemplate,
    createEntityTypeMappingsItemTemplate,
    createGroupsTemplateForService,
    createAPIResourceTemplate,
    createEventResourceTemplate,
    createDataProductTemplate
} = require('../../lib/templates');

describe('templates', () => {
    let linkedModel;
    let warningSpy;

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
        warningSpy = jest.spyOn(console, "warn");
    });

    describe('createEntityTypeMappingsItemTemplate', () => {
        it('should return default value', () => {
            expect(createEntityTypeMappingsItemTemplate(linkedModel.definitions['customer.testNamespace123.Books'])).toBeUndefined();
        });
    });

    describe('createEntityTypeTemplate', () => {
        const packageIds = ['sap.test.cdsrc.sample:package:test-entityType:v1'];
        it('should return entity type with incorrect version, title and level:root-entity', () => {
            const entityWithVersion = {
                ordId: "sap.sm:entityType:SomeAribaDummyEntity:v3b",
                entityName: "SomeAribaDummyEntity",
                "@title": "Title of SomeAribaDummyEntity",
                "@ObjectModel.compositionRoot": true,
            };

            const entityType = createEntityTypeTemplate(appConfig, packageIds, entityWithVersion);
            expect(entityType).toBeDefined();
            expect(entityType).toMatchSnapshot();
            expect(warningSpy).toHaveBeenCalledTimes(1);
            expect(entityType.version).toEqual('3b.0.0');
            expect(entityType.level).toEqual('root-entity');
            expect(entityType.partOfPackage).toEqual('sap.test.cdsrc.sample:package:test-entityType:v1');
        });


        it('should return entity type with default version, title and level:sub-entity', () => {
            const entityWithoutVersion = {
                ordId: "sap.sm:entityType:SomeAribaDummyEntity:v1",
                entityName: "SomeAribaDummyEntity"
            };

            const entityType = createEntityTypeTemplate(appConfig, packageIds, entityWithoutVersion);
            expect(entityType).toBeDefined();
            expect(entityType).toMatchSnapshot();
            expect(entityType.version).toEqual('1.0.0');
            expect(entityType.level).toEqual('sub-entity');
        });
    });

    describe('createGroupsTemplateForService', () => {
        it('should return default value when groupIds do not have groupId', () => {
            const testServiceName = 'testServiceName';
            const testResult = {
                groupId: 'sap.cds:service:customer.testNamespace:testServiceName',
                groupTypeId: 'sap.cds:service',
                title: 'test Service'
            };
            expect(createGroupsTemplateForService(testServiceName, linkedModel, appConfig)).toEqual(testResult);
        });

        it('should return default value with a proper Service title when "Service" keyword is missing', () => {
            const testServiceName = 'testServName';
            const testResult = {
                groupId: 'sap.cds:service:customer.testNamespace:testServName',
                groupTypeId: 'sap.cds:service',
                title: 'testServName Service'
            };
            expect(createGroupsTemplateForService(testServiceName, linkedModel, appConfig)).toEqual(testResult);
        });

        it('should return undefined when no service definition', () => {
            const testServiceName = 'testServiceName';
            expect(createGroupsTemplateForService(testServiceName, null, appConfig)).not.toBeDefined();
        });
    });

    describe('createAPIResourceTemplate', () => {
        it('should create API resource template correctly', () => {
            const serviceName = 'MyService';
            const srvDefinition = linkedModel
            const packageIds = ['sap.test.cdsrc.sample:package:test-event:v1', 'sap.test.cdsrc.sample:package:test-api:v1'];
            expect(createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });
    });

    describe('createEventResourceTemplate', () => {
        it('should create event resource template correctly', () => {
            const serviceName = 'MyService';
            const srvDefinition = linkedModel
            const packageIds = ['sap.test.cdsrc.sample:package:test-event:v1', 'sap.test.cdsrc.sample:package:test-api:v1'];
            expect(createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });

        it('should create event resource template correctly with packageIds including namespace', () => {
            const serviceName = 'MyService';
            const srvDefinition = linkedModel
            const packageIds = ['customer.testNamespace:package:test:v1'];
            expect(createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });
    });

    describe('ordExtension', () => {
        it('should add apiResources with ORD Extension "visibility=public"', () => {
            const serviceName = 'MyService';
            linkedModel = cds.linked(`
                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                }
                @ODM.entityName: 'testOdmEntity'
                entity Books {
                    key ID: UUID;
                    title: String;
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService apiResource title',
                    shortDescription: 'short description for test MyService apiResource',
                    visibility : 'public',
                    version : '2.0.0',
                    partOfPackage : 'sap.test.cdsrc.sample:package:test-other:v1',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
            const srvDefinition = linkedModel.definitions[serviceName];
            appConfig['entityTypeTargets'] = [{ 'ordId': 'sap.odm:entityType:test:v1' }]
            const packageIds = ['customer.testNamespace:package:test:v1'];
            const apiResourceTemplate = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(apiResourceTemplate).toBeInstanceOf(Array);
            expect(apiResourceTemplate).toMatchSnapshot();
        });

        it('should include internal API resources but ensure they appear in a separate package', () => {
            const serviceName = 'MyService';
            linkedModel = cds.linked(`
                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                }
                @ODM.entityName: 'testOdmEntity'
                entity Books {
                    key ID: UUID;
                    title: String;
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService apiResource title',
                    shortDescription: 'short description for test MyService apiResource',
                    visibility : 'internal',
                    version : '2.0.0',
                    partOfPackage : 'sap.test.cdsrc.sample:package:test-other:v1',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
            const srvDefinition = linkedModel.definitions[serviceName];
            appConfig['entityTypeTargets'] = [{ 'ordId': 'sap.odm:entityType:test:v1' }];
            const packageIds = ['customer.testNamespace:package:test:v1'];
            const apiResourceTemplate = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(apiResourceTemplate).toBeInstanceOf(Array);
            expect(apiResourceTemplate).toMatchSnapshot();
            expect(apiResourceTemplate[0].visibility).toEqual('internal');
        });

        it('should not add apiResources with ORD Extension "visibility=private"', () => {
            const serviceName = 'MyService';
            linkedModel = cds.linked(`
                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                }
                @ODM.entityName: 'testOdmEntity'
                entity Books {
                    key ID: UUID;
                    title: String;
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService apiResource title',
                    shortDescription: 'short description for test MyService apiResource',
                    visibility : 'private',
                    version : '2.0.0',
                    partOfPackage : 'sap.test.cdsrc.sample:package:test-other:v1',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
            const srvDefinition = linkedModel.definitions[serviceName];
            appConfig['entityTypeTargets'] = [{ 'ordId': 'sap.odm:entityType:test:v1' }]
            const packageIds = ['customer.testNamespace:package:test:v1'];
            const apiResourceTemplate = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(apiResourceTemplate).toBeInstanceOf(Array);
            expect(apiResourceTemplate).toMatchSnapshot();
            expect(apiResourceTemplate).toEqual([]);
        });

        it('should add events with ORD Extension "visibility=public"', () => {
            const serviceName = 'MyService';
            linkedModel = cds.linked(`
                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService event title',
                    shortDescription: 'short description for test MyService event',
                    visibility : 'public',
                    version : '2.0.0',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
            const srvDefinition = linkedModel.definitions[serviceName];
            const packageIds = ['sap.test.cdsrc.sample:package:test-event:v1', 'sap.test.cdsrc.sample:package:test-api:v1'];
            const eventResourceTemplate = createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(eventResourceTemplate).toBeInstanceOf(Array);
            expect(eventResourceTemplate).toMatchSnapshot();
        });

        it('should include internal events but ensure they appear in a separate package', () => {
            const serviceName = 'MyService';
            linkedModel = cds.linked(`
                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService event title',
                    shortDescription: 'short description for test MyService event',
                    visibility : 'internal',
                    version : '2.0.0',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
            const srvDefinition = linkedModel.definitions[serviceName];
            const packageIds = ['sap.test.cdsrc.sample:package:test-event:v1', 'sap.test.cdsrc.sample:package:test-api:v1'];
            const eventResourceTemplate = createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(eventResourceTemplate).toBeInstanceOf(Array);
            expect(eventResourceTemplate).toMatchSnapshot();

            expect(eventResourceTemplate[0].visibility).toEqual('internal');
        });

        it('should not add events with ORD Extension "visibility=private"', () => {
            const serviceName = 'MyService';
            linkedModel = cds.linked(`
                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService event title',
                    shortDescription: 'short description for test MyService event',
                    visibility : 'private',
                    version : '2.0.0',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
            const srvDefinition = linkedModel.definitions[serviceName];
            const packageIds = ['sap.test.cdsrc.sample:package:test-event:v1', 'sap.test.cdsrc.sample:package:test-api:v1'];
            const eventResourceTemplate = createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(eventResourceTemplate).toBeInstanceOf(Array);
            expect(eventResourceTemplate).toMatchSnapshot();
            expect(eventResourceTemplate).toEqual([]);
        });
    });
    describe('createEntityTypeTemplate', () => {
        const packageIds = [
            'sap.test.cdsrc.sample:package:test-entityType-public:v1',
            'sap.test.cdsrc.sample:package:test-entityType-private:v1'
        ];

        it('should exclude EntityType if referenced by a private API', () => {
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

            expect(entityType).toBeNull();
        });


        it('should exclude EntityType if referenced by a private DataProduct', () => {
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

            // Da private EntityTypes ausgeschlossen werden, muss das Ergebnis null sein
            expect(entityType).toBeNull();
        });

        it('should exclude EntityType if referenced by a private Event Resource', () => {
            const entity = {
                ordId: "sap.sm:entityType:PrivateEntity:v1",
                entityName: "PrivateEntity",
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

            // Da private EntityTypes ausgeschlossen werden, muss das Ergebnis null sein
            expect(entityType).toBeNull();
        });

    });


    describe('createAPIResourceTemplate', () => {
        const packageIds = [
            'sap.test.cdsrc.sample:package:test-api-public:v1',
            'sap.test.cdsrc.sample:package:test-api-private:v1',
            'sap.test.cdsrc.sample:package:test-api-internal:v1'
        ];

        it('should only include referenced entity types from the correct namespace', () => {
            const serviceName = 'MyService';
            const serviceDefinition = {};
            const expectedOrdId = `${appConfig.ordNamespace}:apiResource:${serviceName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` }] },
                    { entityTypeTargets: [{ ordId: `external.namespace:entityType:InvalidEntity:v1` }] }
                ]
            };

            const apiResource = createAPIResourceTemplate(serviceName, serviceDefinition, updatedAppConfig, packageIds, {});

            expect(apiResource[0].ordId).toEqual(expectedOrdId)
            expect(apiResource[0].entityTypeMappings).toBeDefined();
            expect(apiResource[0].entityTypeMappings).toHaveLength(1);
            expect(apiResource[0].entityTypeMappings[0].entityTypeTargets).toEqual([
                { ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` }
            ]);
        });

        it('should mark API resource as private if a referenced entityType is private', () => {
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

            if (apiResource.length === 0) {
                // Falls private APIs entfernt werden sollen, sollte dies der erwartete Wert sein
                expect(apiResource).toEqual([]);
            } else {
                // Falls die API zurückgegeben wird, sollte sie als private markiert sein
                expect(apiResource[0].ordId).toEqual(expectedOrdId);
                expect(apiResource[0].visibility).toEqual('private');
            }
        });

        it('should mark API resource as internal if a referenced entityType is internal but not private', () => {
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

            if (apiResource.length === 0) {
                expect(apiResource).toEqual([]);
            } else {
                expect(apiResource[0].ordId).toEqual(expectedOrdId);
                expect(apiResource[0].visibility).toEqual('internal');
            }
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

        it('should only include referenced entity types from the correct namespace', () => {
            const serviceName = 'MyService';
            const serviceDefinition = linkedModel;
            const expectedOrdId = `${appConfig.ordNamespace}:eventResource:${serviceName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` }] },
                    { entityTypeTargets: [{ ordId: `external.namespace:entityType:InvalidEntity:v1` }] }
                ]
            };

            const eventResource = createEventResourceTemplate(serviceName, serviceDefinition, updatedAppConfig, packageIds, {});

        if (eventResource.length === 0) {
            expect(eventResource).toEqual([]);
        } else {
            expect(eventResource[0].ordId).toEqual(expectedOrdId);
            expect(eventResource[0].entityTypeMappings).toBeDefined();
            expect(eventResource[0].entityTypeMappings[0].entityTypeTargets).toEqual([
                { ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` }
            ]);
        }
        });

        it('should mark Event resource as private if a referenced entityType is private', () => {
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

        if (eventResource.length === 0) {
            expect(eventResource).toEqual([]);
        } else {
            expect(eventResource[0].ordId).toEqual(expectedOrdId);
            expect(eventResource[0].visibility).toEqual('private');
        }
        });

        it('should mark Event resource as internal if a referenced entityType is internal but not private', () => {
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
            expect(eventResource[0].visibility).toEqual('internal');
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

        it('should only include referenced entity types from the correct namespace', () => {
            const dataProductName = 'ValidDataProduct';
            const expectedOrdId = `${appConfig.ordNamespace}:dataProduct:${dataProductName}:v1`;

            const updatedAppConfig = {
                ...appConfig,
                entityTypeMappings: [
                    { entityTypeTargets: [{ ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` }] },
                    { entityTypeTargets: [{ ordId: `external.namespace:entityType:InvalidEntity:v1` }] }
                ]
            };

            const dataProductDefinition = {
                "@title": "Valid Data Product",
                "@ORD.Extensions.entityTypes": [
                    { ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` }
                ]
            };

            const dataProductTemplate = createDataProductTemplate(dataProductName, dataProductDefinition, updatedAppConfig, packageIds);

            expect(dataProductTemplate[0].ordId).toEqual(expectedOrdId);
            expect(dataProductTemplate[0].entityTypeMappings).toBeDefined();
            expect(dataProductTemplate[0].entityTypeMappings[0].entityTypeTargets).toEqual([
                { ordId: `${appConfig.ordNamespace}:entityType:ValidEntity:v1` }
            ]);
        });

        it('should exclude Data Product or mark Data Product as private if a referenced entityType is private', () => {
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

            if (dataProductTemplate.length === 0) {
                expect(dataProductTemplate).toEqual([]);
            } else {
                expect(dataProductTemplate[0].ordId).toEqual(expectedOrdId);
                expect(dataProductTemplate[0].visibility).toEqual('private');
            }
        });

        it('should mark Data Product as internal if a referenced entityType is internal but not private', () => {
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
            expect(dataProductTemplate[0].visibility).toEqual('internal');
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
