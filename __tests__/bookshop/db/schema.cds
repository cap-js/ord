using {
    Currency,
    managed,
    sap
} from '@sap/cds/common';

namespace sap.capire.bookshop;

entity Books : managed {
    key ID       : Integer;
        title    : localized String(111);
        descr    : localized String(1111);
        author   : Association to Authors;
        genre    : Association to Genres;
        @title: '{i18n>Stock}'
        stock    : Integer;
        price    : Decimal(9, 2);
        currency : Currency;
}

@ORD.Extensions.version: '2.0.0'
@ODM.entityName: 'odm.bookshop.Authors'
@EntityRelationship.entityType: 'customer.foo:Authors:v2'
entity Authors : managed {
    key ID    : Integer;
        name  : String(111);
        books : Association to many Books
                    on books.author = $self;
}

/** Hierarchically organized Code List for Genres */
@EntityRelationship.entityType: 'customer.foo:Genres'
entity Genres : sap.common.CodeList {
    key ID       : Integer;
        parent   : Association to Genres;
        children : Composition of many Genres
                       on children.parent = $self;
}

entity Movies : managed {
    key ID       : Integer;
        title    : localized String(111);
        descr    : localized String(1111);
        author   : Association to Authors;
        genre    : Association to Genres;
}
