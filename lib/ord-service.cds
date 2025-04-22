@rest  @path: '/ord/v1'
@ORD.Extensions.implementationStandard: 'sap:ord-document-api:v1'
service OrdService {
    @readonly
    entity documents {
        key id : String;
    }

    @readonly
    entity edmx {
        key service : String;
    }

    @readonly
    entity openapi {
        key service : String;
    }

    @readonly
    entity asyncapi {
        key service : String;
    }
}

@rest  @path: '/.well-known/open-resource-discovery'
@ORD.Extensions.implementationStandard: 'sap:ord-document-api:v1'
service OpenResourceDiscoveryService {}
