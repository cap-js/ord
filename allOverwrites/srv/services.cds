using {ProcessorService,AdminService}  from '@capire/incidents/srv/services';
using from '@capire/incidents/db/schema';

namespace sap.capire.incidents;

annotate ProcessorService with @ORD.Extensions : {
    title           : 'This is Processor Service title',
    shortDescription: 'short description for Processor Service',
    description: 'Here we have the description for ProcessorService',
    version: '1.0.0',
    visibility : 'public',
    extensible : {
      supported : 'no'
    }
};

annotate  AdminService with @ORD.Extensions : {
    title           : 'This is Admin Service title',
    shortDescription: 'short description for Admin Service',
    description: 'Here we have the description for AdminService',
    version: '1.0.0',
    visibility : 'public',
    extensible : {
      supported : 'no'
    }
};


@AsyncAPI.Title         : 'SAP Incident Management'
@AsyncAPI.SchemaVersion : '1.0'
extend service ProcessorService {
  event TitleChange : {
    ID    : Integer;
    title : String @title: 'Title';
  }
}

@AsyncAPI.Title         : 'SAP Incident Management'
@AsyncAPI.SchemaVersion : '1.0'

annotate TitleChange2 with @ORD.Extensions : {
    title           : 'This is Local Service title',
    shortDescription: 'short description for Local Service',
    description: 'Here we have the description for LocalService',
    version: '1.0.0',
    visibility : 'public',
    extensible : {
      supported : 'no'
    }
};

service LocalService {
  event TitleChange2 : {
    ID    : Integer;
    title : String @title: 'Title';
  }
}


annotate sap.capire.incidents.Customers with @ODM.entityName: 'Customers';
annotate sap.capire.incidents.Addresses with @ODM.entityName: 'Addresses';
annotate sap.capire.incidents.Incidents with @ODM.entityName: 'Incidents';
