service wellKnownService @(path: '/.well-known/open-resource-discovery') {
    @open
    entity Metadata {
        id          : UUID;
        contentType : String;
        response    : LargeString;
    }
}