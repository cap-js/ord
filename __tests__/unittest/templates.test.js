const cds = require('@sap/cds');
const {
    createEntityTypeTemplate,
    createGroupsTemplateForService,
    createAPIResourceTemplate,
    createEventResourceTemplate
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
        it('should return default value', () => {
            expect(createEntityTypeTemplate(linkedModel)).toEqual({
                ordId: 'sap.odm:entityType:undefined:v1'
            });
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
            appConfig['odmEntity'] = 'sap.odm:entityType:test:v1'
            const packageIds = ['customer.testNamespace:package:test:v1'];
            const apiResourceTemplate = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(apiResourceTemplate).toBeInstanceOf(Array);
            expect(apiResourceTemplate).toMatchSnapshot();
        });

        it('should not add apiResources with ORD Extension "visibility=internal"', () => {
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
            appConfig['odmEntity'] = 'sap.odm:entityType:test:v1'
            const packageIds = ['customer.testNamespace:package:test:v1'];
            const apiResourceTemplate = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(apiResourceTemplate).toBeInstanceOf(Array);
            expect(apiResourceTemplate).toMatchSnapshot();
            expect(apiResourceTemplate).toEqual([]);
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
            appConfig['odmEntity'] = 'sap.odm:entityType:test:v1'
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

        it('should not add events with ORD Extension "visibility=internal"', () => {
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
            expect(eventResourceTemplate).toEqual([]);
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
