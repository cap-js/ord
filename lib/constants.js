const AUTHENTICATION_TYPE = Object.freeze({
    Open: "open",
    Basic: "basic",
});

const BASIC_AUTH_HEADER_KEY = "authorization";

const BUILD_DEFAULT_PATH = "gen/ord";

const BLOCKED_SERVICE_NAME = Object.freeze({
    MTXServices: "cds.xt.MTXServices",
    OpenResourceDiscoveryService: "OpenResourceDiscoveryService",
});

const ORD_ACCESS_STRATEGY = Object.freeze({
    Open: "open",
    Basic: "basic-auth",
});

const AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP = Object.freeze({
    [AUTHENTICATION_TYPE.Open]: ORD_ACCESS_STRATEGY.Open,
    [AUTHENTICATION_TYPE.Basic]: ORD_ACCESS_STRATEGY.Basic,
});

const CDS_ELEMENT_KIND = Object.freeze({
    action: "action",
    annotation: "annotation",
    context: "context",
    function: "function",
    entity: "entity",
    event: "event",
    service: "service",
    type: "type",
});

const COMPILER_TYPES = Object.freeze({
    oas3: "oas3",
    asyncapi2: "asyncapi2",
    edmx: "edmx",
    csn: "csn",
    mcp: "mcp",
});

const CONTENT_MERGE_KEY = "ordId";

const DATA_PRODUCT_ANNOTATION = "@DataIntegration.dataProduct.type";

const DATA_PRODUCT_SIMPLE_ANNOTATION = "@data.product";

const DATA_PRODUCT_TYPE = Object.freeze({
    primary: "primary",
});

const DESCRIPTION_PREFIX = "Description for ";

const ENTITY_RELATIONSHIP_ANNOTATION = "@EntityRelationship.entityType";

const LEVEL = Object.freeze({
    aggregate: "aggregate",
    rootEntity: "root-entity",
    subEntity: "sub-entity",
});

const OPEN_RESOURCE_DISCOVERY_VERSION = "1.9";

const ORD_EXTENSIONS_PREFIX = "@ORD.Extensions.";

const ORD_ODM_ENTITY_NAME_ANNOTATION = "@ODM.entityName";

const ORD_EXISTING_PRODUCT_PROPERTY = "existingProductORDId";

const ORD_RESOURCE_TYPE = Object.freeze({
    api: "api",
    event: "event",
    integrationDependency: "integrationDependency",
    entityType: "entityType",
});

const ORD_SERVICE_NAME = "OpenResourceDiscoveryService";

const ORD_DOCUMENT_FILE_NAME = "ord-document.json";

const RESOURCE_VISIBILITY = Object.freeze({
    public: "public",
    internal: "internal",
    private: "private",
});

const ALLOWED_VISIBILITY = Object.values(RESOURCE_VISIBILITY);

const IMPLEMENTATIONSTANDARD_VERSIONS = Object.freeze({
    v1: "sap:ord-document-api:v1",
});

const SUPPORTED_IMPLEMENTATIONSTANDARD_VERSIONS = Object.values(IMPLEMENTATIONSTANDARD_VERSIONS);

const SHORT_DESCRIPTION_PREFIX = "Short description of ";

const SEM_VERSION_REGEX =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

module.exports = {
    AUTHENTICATION_TYPE,
    AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP,
    BASIC_AUTH_HEADER_KEY,
    BUILD_DEFAULT_PATH,
    BLOCKED_SERVICE_NAME,
    CDS_ELEMENT_KIND,
    COMPILER_TYPES,
    CONTENT_MERGE_KEY,
    DATA_PRODUCT_ANNOTATION,
    DATA_PRODUCT_SIMPLE_ANNOTATION,
    DATA_PRODUCT_TYPE,
    DESCRIPTION_PREFIX,
    ENTITY_RELATIONSHIP_ANNOTATION,
    LEVEL,
    OPEN_RESOURCE_DISCOVERY_VERSION,
    ORD_ACCESS_STRATEGY,
    ORD_DOCUMENT_FILE_NAME,
    ORD_EXTENSIONS_PREFIX,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    ORD_EXISTING_PRODUCT_PROPERTY,
    ORD_RESOURCE_TYPE,
    ORD_SERVICE_NAME,
    RESOURCE_VISIBILITY,
    ALLOWED_VISIBILITY,
    IMPLEMENTATIONSTANDARD_VERSIONS,
    SUPPORTED_IMPLEMENTATIONSTANDARD_VERSIONS,
    SHORT_DESCRIPTION_PREFIX,
    SEM_VERSION_REGEX,
};
