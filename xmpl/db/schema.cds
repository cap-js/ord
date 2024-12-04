namespace sap.cds.demo;

@ODM.root                     : true
@ODM.entityName               : 'SomeODMEntity'
@ODM.oid                      : 'id'
@title                        : 'Dummy title of Entity with corresponding ODM entity title'
entity EntityWithCorrespondingODMEntity {
    key id : UUID;
    propertyA: String(10);
    propertyB: String(20);
}

@ObjectModel.compositionRoot  : true
@EntityRelationship.entityType: 'sap.sample:SomeAribaDummyEntity'
@title                        : 'Dummy title of Ariba entity'
entity SomeAribaEntity {
    key id : UUID;
    propertyC: String(10);
    propertyD: String(20);
}
