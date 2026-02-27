using {test.integration as my} from '../db/schema';
using {test.sai.Supplier.v1 as SaiSupplier} from 'test-sai-supplier-v1';
using {test.s4.Supplier.v1 as S4Supplier} from 'test-s4-supplier-v1';

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
    {
        url        : 'https://test-service.api.example.com',
        description: 'Production'
    },
    {
        url        : 'https://test-service-sandbox.api.example.com',
        description: 'Sandbox'
    }
];

// Service consuming external Data Products
service SupplierService {
    entity SaiSuppliers as projection on SaiSupplier.Supplier;
    entity S4Suppliers  as projection on S4Supplier.Supplier;
}

// Customize IntegrationDependency aspects via @ORD.Extensions
annotate test.sai.Supplier.v1 with @ORD.Extensions: {
    title      : 'Test SAI Supplier API',
    description: 'Integration with Test SAI Supplier Data Product'
};

annotate test.s4.Supplier.v1 with @ORD.Extensions: {
    title      : 'Test S4 Supplier API',
    description: 'Integration with Test S4 Supplier Data Product'
};
