using {sap.cds.demo as my} from '../db/schema';
using {
    ProcessorService,
    AdminService
} from './incidents-services';

namespace sap.capire.incidents;

// ProcessorService annotations removed - not generating DPD for this service

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

// AdminService with correct organizational standard annotations
@title: 'Admin Service Data Product'
@DataIntegration.dataProduct.type: 'primary'
extend service AdminService {}

annotate sap.capire.incidents.Customers with @ODM.entityName: 'Customers';
annotate sap.capire.incidents.Customers with @EntityRelationship.entityType: 'sap.capire.incidents:Customers';

annotate sap.capire.incidents.Addresses with @ODM.entityName: 'Addresses';
annotate sap.capire.incidents.Addresses with @EntityRelationship.entityType: 'sap.capire.incidents:Addresses';

annotate sap.capire.incidents.Incidents with @ODM.entityName: 'Incidents';
annotate sap.capire.incidents.Incidents with @EntityRelationship.entityType: 'sap.capire.incidents:Incidents';

@title : 'Entertainment Data Product'
@DataIntegration.dataProduct.type: 'primary'
service EntertainmentDataProduct {

    entity Cinema        as projection on my.Cinema;
    entity Film          as projection on my.Movie;
    entity Show          as projection on my.Show;

}