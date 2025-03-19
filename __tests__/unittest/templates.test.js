const cds = require('@sap/cds');
const { AUTHENTICATION_TYPE } = require('../../lib/constants');

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
});
