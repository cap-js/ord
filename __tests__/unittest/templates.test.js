const cds = require('@sap/cds');
const templates = require('../../lib/templates');

describe('templates', () => {
    let linkedModel;
    const appConfig = {
        ordNamespace: 'customer.testNamespace',
        appName: 'testAppName'
    };

    beforeEach(() => {
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
            expect(templates.createEntityTypeTemplate(linkedModel)).toEqual({
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
            expect(templates.createGroupsTemplateForService(testServiceName, linkedModel, appConfig)).toEqual(testResult);
        });
    });

    describe('createAPIResourceTemplate', () => {
        it('should create API resource template correctly', () => {
            const serviceName = 'MyService';
            const srvDefinition = linkedModel
            const packageIds = new Set()
            packageIds.add('sap.test.cdsrc.sample:package:test-event:v1');
            packageIds.add('sap.test.cdsrc.sample:package:test-api:v1');
            expect(templates.createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });
    });

    describe('createEventResourceTemplate', () => {
        it('should create event resource template correctly', () => {
            const serviceName = 'MyService';
            const srvDefinition = linkedModel
            const packageIds = new Set()
            packageIds.add('sap.test.cdsrc.sample:package:test-event:v1');
            packageIds.add('sap.test.cdsrc.sample:package:test-api:v1');
            expect(templates.createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });

        it('should create event resource template correctly with packageIds including namespace', () => {
            const serviceName = 'MyService';
            const srvDefinition = linkedModel
            const packageIds = new Set();
            packageIds.add('customer.testNamespace:package:test:v1');
            expect(templates.createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });
    });

    describe('ordExtension', () => {
        it('should add events with ord extensions correctly', () => {
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
            const packageIds = new Set()
            packageIds.add('sap.test.cdsrc.sample:package:test-event:v1');
            packageIds.add('sap.test.cdsrc.sample:package:test-api:v1');
            expect(templates.createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });

        it('should add apiResources with ord extensions correctly', () => {
            const serviceName = 'MyService';
            linkedModel = cds.linked(`
                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService apiResource title',
                    shortDescription: 'short description for test MyService apiResource',
                    visibility : 'private',
                    version : '2.0.0',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
            const srvDefinition = linkedModel.definitions[serviceName];
            const packageIds = new Set();
            packageIds.add('customer.testNamespace:package:test:v1');
            expect(templates.createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });
    });


});
