using {ProcessorService,AdminService}  from '@capire/incidents/srv/services';
using from '@capire/incidents/db/schema';
// !@#$%^&*()
namespace sap.capire.incidents;

annotate ProcessorService with @ORD.Extensions : {
    title           : 'test this is a sample  ok 5',
    shortDescription: 'event sample shortDescription',
    visibility : 'pvt',
    extensible : {
      supported : 'kldjbisbkvbfky'
    }
};

annotate ProcessorService.test with @ORD.Extensions.test : {
    title : 'test this is a sample',
    shortDescription : 'event sample shortDescription'
};

annotate AdminService with @ORD.Extensions : {
  title : 'test this is a sample 2',
  shortDescription : 'event sample shortDescription 2',
  description: 'ok'
};