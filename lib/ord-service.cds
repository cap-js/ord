@rest  @path: '/ord/v1'
@ORD.Extensions.implementationStandard: 'sap:ord-document-api:v1'
service OrdService {
    @readonly
    entity documents {
        key id : String;
    }

    function api() returns {};
}

@rest  @path: '/.well-known/open-resource-discovery'
@ORD.Extensions.implementationStandard: 'sap:ord-document-api:v1'
service OpenResourceDiscoveryService {}
