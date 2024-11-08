using {sap.capire.bookshop as my} from '../db/schema';

service CatalogService @(path: '/browse') {

    @readonly
    entity Books as
        select from my.Books {
            *,
            author.name as author
        }
        excluding {
            createdBy,
            modifiedBy
        };

    @requires: 'authenticated-user'
    action submitOrder(book : Books:ID, quantity : Integer);

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
}

annotate CatalogService with @ORD.Extensions: {
    title             : 'This is test Catalog Service title',
    shortDescription  : 'short description for test CatalogService',
    visibility        : 'internal',
    version           : '2.0.0',
    extensible        : {supported: 'yes'}
};