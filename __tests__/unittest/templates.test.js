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
                // TODO: fix undefined. Root cause: get the value from ${entity['@ODM.entityName']} without setting default value
                ordId: 'sap.odm:entityType:undefined:v1'
            });
        });
    });

    describe('checkEntityFunctionAction', () => {
        it('should return entity', () => {
            const testResult = [
                {
                    type: 'entity',
                    name: 'customer.testNamespace123.Books' ,
                    entityType: 'customer.testNamespace123.Books',
                    entitySet: 'customer.testNamespace123.Books',
                    entityTypeMapping: 'undefined:entityType:customer.testNamespace123.Books:v1',
                    entitySetMapping: 'undefined:entitySet:customer.testNamespace123.Books:v1',
                }
            ]
            expect(templates.checkEntityFunctionAction(linkedModel, global)).toEqual(testResult);
        });

        it('should return actions', () => {
        });

        it('should return function', () => {
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

        // TODO: is that correct?
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
                title: 'test Service Title'
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
                title: ' Service Title'
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

            const testResult = [
                {
                  ordId: 'customer:apiResource:undefined.MyService:v1',
                  title: 'The service is for MyService',
                  shortDescription: 'Here we have the shortDescription for MyService',
                  description: 'Here we have the description for MyService',
                  version: '1.0.0',
                  visibility: 'public',
                  partOfPackage: undefined,
                  partOfGroups: ['sap.cds:service:customer:undefined.MyService'],
                  releaseStatus: 'active',
                  apiProtocol: 'odata-v4',
                  resourceDefinitions: [
                    {
                      type: 'openapi-v3',
                      mediaType: 'application/json',
                      url: '/.well-known/open-resource-discovery/v1/api-metadata/MyService.oas3.json',
                      accessStrategies: [{ type: 'open' }],
                    },
                    {
                      type: 'edmx',
                      mediaType: 'application/xml',
                      url: '/.well-known/open-resource-discovery/v1/api-metadata/MyService.edmx',
                      accessStrategies: [{ type: 'open' }],
                    },
                  ],
                  entryPoints: ['/odata/v4/my'],
                  extensible: {
                    supported: 'no',
                  },
                  entityTypeMappings: [{ entityTypeTargets: undefined }],
                },
              ];
            expect(templates.fCreateAPIResourceTemplate(srv, srvDefinition, global, packageIds)).toEqual(testResult);
          });
    });

    describe('fCreateEventResourceTemplate', () => {
        it('should create API resource template correctly', () => {
            const srv = 'MyService';
            const srvDefinition = linkedModel
            console.log('srvDefinition:', srvDefinition._service);
            global.namespace = 'customer';
            global.appName = 'testAppName';
            const packageIds = ['package1'];

            // TODO: temporary solution, fix it
            srvDefinition._service = {            
                name: 'MyService',
            };

            const testResult = {
                ordId: 'customer:eventResource:undefined.MyService:v1',
                title: 'ODM testAppName Events',
                shortDescription: 'Example ODM Event',
                description: 'This is an example event catalog that contains only a partial ODM testAppName V1 event',
                version: '1.0.0',
                releaseStatus: 'beta',
                partOfPackage: undefined,
                partOfGroups: ['sap.cds:service:customer:undefined.MyService'],
                visibility: 'public',
                resourceDefinitions: [
                    {
                    type: 'asyncapi-v2',
                    mediaType: 'application/json',
                    url: '/.well-known/open-resource-discovery/v1/api-metadata/MyService.asyncapi2.json',
                    accessStrategies: [
                        {
                        type: 'open',
                        },
                    ],
                    },
                ],
                extensible: { supported: 'no' },
            };
            expect(templates.fCreateEventResourceTemplate(srv, srvDefinition, global, packageIds)).toEqual(testResult);
          });
    });
});
