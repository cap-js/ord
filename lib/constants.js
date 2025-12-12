const AUTHENTICATION_TYPE = Object.freeze({
    Open: "open",
    Basic: "basic",
    CfMtls: "cf-mtls",
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
    CfMtls: "sap:cmp-mtls:v1",
});

const AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP = Object.freeze({
    [AUTHENTICATION_TYPE.Open]: ORD_ACCESS_STRATEGY.Open,
    [AUTHENTICATION_TYPE.Basic]: ORD_ACCESS_STRATEGY.Basic,
    [AUTHENTICATION_TYPE.CfMtls]: ORD_ACCESS_STRATEGY.CfMtls,
});

// CF mTLS default header names
const CF_MTLS_HEADERS = Object.freeze({
    ISSUER: "x-ssl-client-issuer-dn",
    SUBJECT: "x-ssl-client-subject-dn",
    ROOT_CA: "x-ssl-client-root-ca-dn",
    // XFCC (X-Forwarded-Client-Cert) headers for proxy-verified mTLS
    XFCC: "x-forwarded-client-cert",
    CLIENT: "x-ssl-client",
    CLIENT_VERIFY: "x-ssl-client-verify",
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

const OPEN_RESOURCE_DISCOVERY_VERSION = "1.12";

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

// CF mTLS Error Reasons
const CF_MTLS_ERROR_REASON = Object.freeze({
    NO_HEADERS: "NO_HEADERS",
    HEADER_MISSING: "HEADER_MISSING",
    INVALID_ENCODING: "INVALID_ENCODING",
    XFCC_VERIFICATION_FAILED: "XFCC_VERIFICATION_FAILED",
    CERT_PAIR_MISMATCH: "CERT_PAIR_MISMATCH",
    ROOT_CA_MISMATCH: "ROOT_CA_MISMATCH",
});

// HTTP Configuration Constants
const HTTP_CONFIG = Object.freeze({
    METHOD_GET: "GET",
    CONTENT_TYPE_JSON: "application/json",
    MTLS_TIMEOUT_MS: 10000,
});

// Authentication String Constants
const AUTH_STRINGS = Object.freeze({
    BASIC_PREFIX: "Basic ",
    WWW_AUTHENTICATE_REALM: 'Basic realm="401"',
});

module.exports = {
    AUTHENTICATION_TYPE,
    AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP,
    BASIC_AUTH_HEADER_KEY,
    BUILD_DEFAULT_PATH,
    BLOCKED_SERVICE_NAME,
    CDS_ELEMENT_KIND,
    CF_MTLS_HEADERS,
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
    CF_MTLS_ERROR_REASON,
    HTTP_CONFIG,
    AUTH_STRINGS,
};
