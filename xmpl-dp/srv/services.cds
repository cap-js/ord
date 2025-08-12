using {sap.cds.demo as my} from '../db/schema';
using {
    ProcessorService,
    AdminService
} from './incidents-services';

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

@AsyncAPI.Title                  : 'SAP Incident Management'
@AsyncAPI.SchemaVersion          : '1.0'
service LocalService {
    entity Entertainment as projection on my.Cinema;
    entity Film          as projection on my.Movie;

    event TitleChange : {
        ID    : Integer;
        title : String @title: 'Changed Title';
    }
}

annotate LocalService with @ORD.Extensions: {title: 'This is Local Service title'};

annotate AdminService with @ORD.Extensions: {
    title         : 'This is Admin Service title',
    industry      : [
        'Retail',
        'Consumer Products'
    ],
    lineOfBusiness: ['Sales'],
};

annotate AdminService with @ORD.dataProduct: {
    title: 'Admin Service Data Product',
    type: 'primary',
    visibility: 'public',
    industry: ['Retail', 'Consumer Products'],
    lineOfBusiness: ['Sales', 'Marketing'],
    releaseStatus: 'beta',
    deprecationDate: '2025-12-31',
    sunsetDate: '2026-06-30'
};

annotate sap.capire.incidents.Customers with @ODM.entityName: 'Customers';
annotate sap.capire.incidents.Addresses with @ODM.entityName: 'Addresses';
annotate sap.capire.incidents.Incidents with @ODM.entityName: 'Incidents';

@title : 'Entertainment Data Product'
@DataIntegration.dataProduct.type: 'primary'
service EntertainmentDataProduct {

    entity Cinema        as projection on my.Cinema;
    entity Film          as projection on my.Movie;
    entity Show          as projection on my.Show;

}