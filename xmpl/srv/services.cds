using {
    ProcessorService,
    AdminService
} from '@capire/incidents/srv/services';
using from '@capire/incidents/db/schema';
using {sap.s4.beh.businesspartner.v1.BusinessPartner.Created.v1 as Created} from './external/CE_BUSINESSPARTNEREVENTS.asyncapi';

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
    event TitleChange2 : {
        ID    : Integer;
        title : String @title: 'Title';
    }
}

annotate AdminService with @ORD.Extensions: {
    title         : 'This is Admin Service title',
    industry      : [
        'Retail',
        'Consumer Products'
    ],
    lineOfBusiness: ['Sales']
};

service OwnService {
    event BPCreated : projection on Created;
}

annotate OwnService with @ORD.Extensions: {
    title           : 'This is Own Service title',
    shortDescription: 'short description for OwnService',
    visibility      : 'public',
    extensible      : {supported: 'no'}
};

annotate sap.capire.incidents.Customers with @ODM.entityName: 'Customers';
annotate sap.capire.incidents.Addresses with @ODM.entityName: 'Addresses';
annotate sap.capire.incidents.Incidents with @ODM.entityName: 'Incidents';
