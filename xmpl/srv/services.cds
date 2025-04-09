using {sap.cds.demo as my} from '../db/schema';
using {
    ProcessorService,
    AdminService
} from '@capire/incidents/srv/services';
using from '@capire/incidents/db/schema';

namespace sap.capire.incidents;

// This helps CAP to discover already existing endpoint for ORD
@rest @path:'/.well-known/open-resource-discovery'
service OrdService {}

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

    entity Film as projection on my.Movie;

    event TitleChange : {
        ID    : Integer;
        title : String @title: 'Changed Title';
    }
}

annotate LocalService with @ORD.Extensions: {
    title         : 'This is Local Service title'
};

annotate AdminService with @ORD.Extensions: {
    title         : 'This is Admin Service title',
    industry      : [
        'Retail',
        'Consumer Products'
    ],
    lineOfBusiness: ['Sales']
};

annotate sap.capire.incidents.Customers with @ODM.entityName: 'Customers';
annotate sap.capire.incidents.Addresses with @ODM.entityName: 'Addresses';
annotate sap.capire.incidents.Incidents with @ODM.entityName: 'Incidents';