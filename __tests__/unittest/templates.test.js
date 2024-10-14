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
            const srv = 'MyService';
            const srvDefinition = linkedModel
            const packageIds = new Set('package1');
            expect(templates.createAPIResourceTemplate(srv, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });
    });

    describe('createEventResourceTemplate', () => {
        it('should create event resource template correctly', () => {
            const srv = 'MyService';
            const srvDefinition = linkedModel
            const packageIds = new Set()
            packageIds.add('sap.test.cdsrc.sample:package:test-event:v1');
            packageIds.add('sap.test.cdsrc.sample:package:test-api:v1');
            expect(templates.createEventResourceTemplate(srv, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });

        it('should create event resource template correctly with packageIds including namespace', () => {
            const srv = 'MyService';
            const srvDefinition = linkedModel
            const packageIds = new Set();
            packageIds.add('customer.testNamespace:package:test:v1');
            expect(templates.createEventResourceTemplate(srv, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });
    });


});
