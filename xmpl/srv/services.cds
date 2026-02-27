using {sap.cds.demo as my} from '../db/schema';
using {
    ProcessorService,
    AdminService
} from './incidents-services';
using {sap.sai.Supplier.v1 as SaiSupplier} from 'sap-sai-supplier-v1';
using {sap.s4com.Supplier.v1 as S4comSupplier} from 'sap-s4com-supplier-v1';

namespace sap.capire.incidents;

annotate ProcessorService with @ORD.Extensions: {
    title           : 'This is Processor Service title',
    shortDescription: 'short description for Processor Service',
    visibility      : 'public',
    extensible      : {supported: 'no'}
};

@AsyncAPI.Title        : 'SAP Incident Management'
@AsyncAPI.SchemaVersion: '1.0'
extend service ProcessorService {
    event TitleChange : {
        ID    : Integer;
        title : String @title: 'Title';
    }
}

@AsyncAPI.Title        : 'SAP Incident Management'
@AsyncAPI.SchemaVersion: '1.0'
service LocalService {
    entity Entertainment as projection on my.Cinema;
    entity Film          as projection on my.Movie;

    event TitleChange : {
        ID    : Integer;
        title : String @title: 'Changed Title';
    }
}

annotate LocalService with @ORD.Extensions: {title: 'This is Local Service title'};

// Service-level OpenAPI servers configuration
annotate LocalService with @OpenAPI.servers: [
    {
        url        : 'https://local-service.api.sap.com',
        description: 'LocalService Production'
    },
    {
        url        : 'https://local-service-sandbox.api.sap.com',
        description: 'LocalService Sandbox'
    }
];

annotate AdminService with @ORD.Extensions: {
    title         : 'This is Admin Service title',
    industry      : [
        'Retail',
        'Consumer Products'
    ],
    lineOfBusiness: ['Sales'],
};

annotate sap.capire.incidents.Customers with @ODM.entityName: 'Customers';
annotate sap.capire.incidents.Addresses with @ODM.entityName: 'Addresses';
annotate sap.capire.incidents.Incidents with @ODM.entityName: 'Incidents';

@title                           : 'Entertainment Data Product'
@DataIntegration.dataProduct.type: 'primary'
service EntertainmentDataProduct {

    entity Cinema as projection on my.Cinema;
    entity Film   as projection on my.Movie;
    entity Show   as projection on my.Show;

}

// Services consuming external Data Products
service SupplierService {
    entity SaiSuppliers   as projection on SaiSupplier.Supplier;
    entity S4comSuppliers as projection on S4comSupplier.Supplier;
}

// Customize IntegrationDependency aspects via @ORD.Extensions
annotate sap.sai.Supplier.v1 with @ORD.Extensions: {
    title      : 'SAI Supplier API',
    description: 'Integration with SAP Analytics Intelligence Supplier Data Product'
};

annotate sap.s4com.Supplier.v1 with @ORD.Extensions: {
    title      : 'S/4HANA Cloud Supplier API',
    description: 'Integration with SAP S/4HANA Cloud Supplier Data Product',
    mandatory  : true
};

// INA Protocol Service - demonstrates ORD-only protocol handling
// CDS doesn't recognize 'ina' protocol, but ORD plugin maps it to 'sap-ina-api-v1'
@protocol: 'ina'
@title   : 'Analytics Service'
service AnalyticsService {
    entity Cinema as projection on my.Cinema;
    entity Film   as projection on my.Movie;
}

annotate AnalyticsService with @ORD.Extensions: {
    title           : 'Analytics Service for SAP INA',
    shortDescription: 'INA protocol service for analytics queries',
    visibility      : 'public'
};
