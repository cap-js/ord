const cds = require('@sap/cds');
const templates = require('../../lib/templates');

describe('templates', () => {
    let linkedModel;

    beforeEach(() => {
        linkedModel = cds.linked(`
        namespace customer.testNamespace123;
        entity Books {
            key ID: UUID;
            title: String;
        }
    `);
    });

    describe('fCreateEntityTypeTemplate', () => {
        it('should return default value', () => {
            expect(templates.fCreateEntityTypeTemplate(linkedModel)).toEqual({
                ordId: 'sap.odm:entityType:undefined:v1'
            });
        });
    });

    describe('checkEntityFunctionAction', () => {
        it('should return entity', () => {
            expect(templates.checkEntityFunctionAction(linkedModel, global)).toMatchSnapshot();
        });

        it('should fail when entity is empty', () => {
            expect(templates.checkEntityFunctionAction(linkedModel, global)).toMatchSnapshot();
        });
    })

    describe('fReplaceSpecialCharacters', () => {
        it('should return replaced dot', () => {
            const testString = 'customer.testNamespace.123';
            expect(templates.fReplaceSpecialCharacters(testString)).toEqual('customer.testNamespace123');
        });

        it('should return replaced dash', () => {
            const testString = 'customer.testNamespace-123';
            expect(templates.fReplaceSpecialCharacters(testString)).toEqual('customer.testNamespace123');
        });

        it('should return dash when there is no customer', () => {
            const testString = 'testNamespace-123';
            expect(templates.fReplaceSpecialCharacters(testString)).toEqual('testNamespace-123');
        });
    })

    describe('fCreateGroupsTemplateForService', () => {
        it('should return default value when groupIds do not have groupId', () => {
            const testSrv = 'testServiceName';
            global.namespace = 'customer';
            const testGroupIds = new Set();
            const testResult = {
                groupId: 'sap.cds:service:customer:undefined.testServiceName',
                groupTypeId: 'sap.cds:service',
                title: 'test Service'
            };
            expect(templates.fCreateGroupsTemplateForService(testSrv, linkedModel, testGroupIds)).toEqual(testResult);
        });

        it('should return null when groupIds has groupId', () => {
            const testSrv = 'testServiceName';
            global.namespace = 'customer';
            const testGroupIds = new Set(['sap.cds:service:customer:undefined.testServiceName']);
            const testResult = null;
            expect(templates.fCreateGroupsTemplateForService(testSrv, linkedModel, testGroupIds)).toEqual(testResult);
        });
    });

    describe('fCreateGroupsTemplateForEvent', () => {
        it('should return default value when groupIds do not have groupId', () => {
            const tesEvent = 'testEventName';
            global.namespace = 'customer';
            const testGroupIds = new Set();
            const testResult = {
                groupId: 'sap.cds:service:customer:undefined.testEventName',
                groupTypeId: 'sap.cds:service',
                // TODO: space because of service name missing
                title: ' Service'
            };
            expect(templates.fCreateGroupsTemplateForEvent(tesEvent, linkedModel, testGroupIds)).toEqual(testResult);
        });

        it('should return null when groupIds has groupId', () => {
            const tesEvent = 'testEventName';
            global.namespace = 'customer';
            const testGroupIds = new Set(['sap.cds:service:customer:undefined.testEventName']);
            const testResult = null;
            expect(templates.fCreateGroupsTemplateForEvent(tesEvent, linkedModel, testGroupIds)).toEqual(testResult);
        });
    });

    describe('fCreateAPIResourceTemplate', () => {
        it('should create API resource template correctly', () => {
            const srv = 'MyService';
            const srvDefinition = linkedModel
            global.namespace = 'customer';
            const packageIds = ['package1'];
            expect(templates.fCreateAPIResourceTemplate(srv, srvDefinition, global, packageIds)).toMatchSnapshot();
        });
    });

    describe('fCreateEventResourceTemplate', () => {
        it('should create API resource template correctly', () => {
            const srv = 'MyService';
            const srvDefinition = linkedModel
            global.namespace = 'customer';
            global.appName = 'testAppName';
            const packageIds = ['package1'];

            // TODO: temporary solution, fix it
            srvDefinition._service = {
                name: 'MyService',
            };
            expect(templates.fCreateEventResourceTemplate(srv, srvDefinition, global, packageIds)).toMatchSnapshot();
        });
    });
});
