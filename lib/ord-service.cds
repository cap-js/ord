@rest  @path: '/ord/v2'
@ORD.Extensions.implementationStandard: 'sap:ord-document-api:v1'
service OrdService {
    @readonly
    entity documents {
        key id : String;
    }

    @readonly
    entity csn {
        key id : String;
    }

    function api(arg : String, service : String) returns {};
}

// note: /.well-known/open-resource-discovery needs another service
@rest  @path: '/.well-known'
@ORD.Extensions.implementationStandard: 'sap:ord-document-api:v1'
service WellKnownService {
    function ord() returns {};
}