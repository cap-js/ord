using {ProcessorService,AdminService}  from '@capire/incidents/srv/services';
using from '@capire/incidents/db/schema';

namespace sap.capire.incidents;

annotate ProcessorService with @ORD.Extensions : {
    title           : 'This is Processor Service title',
    shortDescription: 'short description for Processor Service',
    visibility : 'public',
    extensible : {
      supported : 'no'
    }
};

@AsyncAPI.Title         : 'SAP Incident Management'
@AsyncAPI.SchemaVersion : '1.0'
extend service ProcessorService {
  @ORD.Extensions: {
    title           : 'This is title for TitleChange event',
    shortDescription: 'Event TitleChange short description'
  }
  event TitleChange : {
    ID    : Integer;
    title : String @title: 'Title';
  }
}

annotate AdminService with @ORD.Extensions : {
  title : 'This is Admin Service title',
  shortDescription : 'short description for Admin Service'
};


annotate sap.capire.incidents.Customers with @ODM.entityName: 'Customers';
annotate sap.capire.incidents.Addresses with @ODM.entityName: 'Addresses';
annotate sap.capire.incidents.Incidents with @ODM.entityName: 'Incidents';
