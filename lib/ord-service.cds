@rest  @path: '/ord/v1'
@ORD.Extensions.implementationStandard: 'sap:ord-document-api:v1'
service OrdService {
    @readonly
    entity documents {
        key id : String;
    }
}

@rest  @path: '/.well-known/open-resource-discovery'
@ORD.Extensions.implementationStandard: 'sap:ord-document-api:v1'
service OpenResourceDiscoveryService {}
