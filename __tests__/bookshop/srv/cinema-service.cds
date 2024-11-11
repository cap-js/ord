using {sap.capire.bookshop as my} from '../db/schema';

service CinemaService @(path: '/browse') {

    @readonly
    entity Movies as
        select from my.Movies {
            *,
            author.name as author
        }
        excluding {
            createdBy,
            modifiedBy
        };

    @requires: 'authenticated-user'
    action submitOrder(book : Movies:ID, quantity : Integer);

    event MovieCreated : {
        ID    : Integer;
        title : String @title: 'Title';
    };

    event MovieDeleted : {
        ID : Integer;
    };

    event MovieUpdated : {
        ID    : Integer;
        title : String @title: 'Title';
    }
}

annotate CinemaService with @ORD.Extensions: {
    title             : 'This is test Cinema Service title',
    shortDescription  : 'short description for test CinemaService',
    visibility        : 'internal',
    version           : '1.0.0',
    extensible        : {supported: 'yes'}
};