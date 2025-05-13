namespace sap.cds.demo;

@ODM.root                     : true
@ODM.entityName               : 'Cinema'
@ODM.oid                      : 'id'
@title                        : 'Cinema Title'
entity Cinema {
    key id : UUID;
    name: String(50);
    location: String(100);
}

@ObjectModel.compositionRoot  : true
@EntityRelationship.entityType: 'customer.sample:Movie'
@title                        : 'Movie Title'
entity Movie {
    key id : UUID;
    title: String(100);
    genre: String(50);
    duration: Integer;
}
