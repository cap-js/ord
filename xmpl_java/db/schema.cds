namespace sap.cds.demo;

@ODM.root      : true
@ODM.entityName: 'Cinema'
@ODM.oid       : 'id'
@title         : 'Cinema Title'
entity Cinema {
    key id       : UUID;
        name     : String(50);
        location : String(100);
}

@ObjectModel.compositionRoot  : true
@EntityRelationship.entityType: 'customer.sample:Movie'
@title                        : 'Movie Details'
entity Movie {
    key id       : UUID;
        title    : String(100);
        genre    : String(50);
        duration : Integer;
        shows    : Composition of many Show
                       on shows.movie = $self;

}


@EntityRelationship.entityType: 'customer.sample:Show'
@title                        : 'Show Details'
entity Show {
    key id           : UUID;
        movie        : Association to one Movie not null;
        specialEvent : Boolean;
        location     : Association to one Cinema not null;
}
