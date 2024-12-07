using {sap.capire.bookshop as my} from '../db/schema';
using {sap.s4.beh.businesspartner.v1.BusinessPartner.Created.v1 as Created } from './external/CE_BUSINESSPARTNEREVENTS.asyncapi';

service AdminService @(requires: 'authenticated-user') {
    entity Books   as projection on my.Books;
    entity Authors as projection on my.Authors;

    event BookCreated : {
        ID    : Integer;
        title : String @title: 'Title';
    };

    event BookDeleted : {
        ID : Integer;
    };

    event BookUpdated : {
        ID    : Integer;
        title : String @title: 'Title';
    }
    
    event BPCreated : projection on Created;

    function sum(x : Integer, y : Integer)  returns Integer;
    action   add(x : Integer, to : Integer) returns Integer;
}

annotate AdminService with @ORD.Extensions: {
    title             : 'This is test AdminService title',
    shortDescription  : 'short description for test AdminService',
    visibility        : 'public',
    version           : '2.0.0',
    extensible        : {supported: 'yes'},
    entityTypeMappings: {entityTypeTargets: [{ordId: 'sap.odm:entityType:test-from-extension:v1'}]},
};
