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
        stock    : Integer;
        price    : Decimal(9, 2);
        currency : Currency;
}

@ODM.entityName: 'odm.bookshop.Authors'
@EntityRelationship.entityType: 'customer.foo:Authors'
entity Authors : managed {
    key ID    : Integer;
        name  : String(111);
        books : Association to many Books
                    on books.author = $self;
}

/** Hierarchically organized Code List for Genres */
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
