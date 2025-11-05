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
        movie_id     : UUID not null;
        movie        : Association to one Movie
                           on movie.id = movie_id;
        specialEvent : Boolean;
        location_id  : UUID not null;
        location     : Association to one Cinema
                           on location.id = location_id;
}
