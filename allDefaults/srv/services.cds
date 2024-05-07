using {ProcessorService,AdminService}  from '@capire/incidents/srv/services';
using from '@capire/incidents/db/schema';

namespace sap.capire.incidents;

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
service LocalService {
  event TitleChange2 : {
    ID    : Integer;
    title : String @title: 'Title';
  }
}


annotate sap.capire.incidents.Customers with @ODM.entityName: 'Customers';
annotate sap.capire.incidents.Addresses with @ODM.entityName: 'Addresses';
annotate sap.capire.incidents.Incidents with @ODM.entityName: 'Incidents';
