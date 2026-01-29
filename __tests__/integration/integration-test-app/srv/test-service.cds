using {test.integration as my} from '../db/schema';

service TestService @(path: '/test') {

    @readonly
    entity TestEntities as select from my.TestEntity;

    @requires: 'authenticated-user'
    action testAction(id: Integer, value: String) returns String;

    event TestEvent : {
        ID      : Integer;
        message : String;
    };
}

annotate TestService with @ORD.Extensions: {
    title           : 'Test Service for Integration Testing',
    shortDescription: 'Minimal service for ORD integration tests',
    visibility      : 'public',
    version         : '1.0.0'
};

annotate TestService with @OpenAPI.servers: [
    { url: 'https://test-service.api.example.com', description: 'Production' },
    { url: 'https://test-service-sandbox.api.example.com', description: 'Sandbox' }
];
