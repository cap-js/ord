

service ORDMetadataService @(path: '/.well-known') {
    @(path: '/open-resource-discovery')
    function getORDMetadata() returns String;
}



service ORDDocumentService @(path: '/open-resource-discovery/v1/documents/1') {
    function getORDDocument() returns String;
}