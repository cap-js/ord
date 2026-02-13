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
    graphql: "graphql",
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

const OPENAPI_SERVERS_ANNOTATION = "@OpenAPI.servers";

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

const MCP_CUSTOM_TYPE = "sap:mcp-server-card:v0";

// ORD apiProtocol values
const ORD_API_PROTOCOL = Object.freeze({
    ODATA_V4: "odata-v4",
    ODATA_V2: "odata-v2",
    REST: "rest",
    GRAPHQL: "graphql",
    SAP_INA: "sap-ina-api-v1",
    SAP_DATA_SUBSCRIPTION: "sap.dp:data-subscription-api:v1",
});

// Mapping from CAP protocol kind to ORD apiProtocol
// CAP may return 'odata', 'odata-v4', 'rest', 'graphql', etc.
const CAP_TO_ORD_PROTOCOL_MAP = Object.freeze({
    "odata": ORD_API_PROTOCOL.ODATA_V4,
    "odata-v4": ORD_API_PROTOCOL.ODATA_V4,
    "odata-v2": ORD_API_PROTOCOL.ODATA_V2,
    "rest": ORD_API_PROTOCOL.REST,
    "graphql": ORD_API_PROTOCOL.GRAPHQL,
});

// Protocols that ORD supports but CAP may not recognize (endpoints4 returns [])
// These need special handling in the ORD plugin
const ORD_ONLY_PROTOCOLS = Object.freeze({
    "ina": {
        apiProtocol: ORD_API_PROTOCOL.SAP_INA,
        hasEntryPoints: false,
        hasResourceDefinitions: false,
    },
    "graphql": {
        apiProtocol: ORD_API_PROTOCOL.GRAPHQL,
        hasEntryPoints: true,
        hasResourceDefinitions: true,
    },
});

// Protocols that the ORD plugin cannot currently generate definitions for
const PLUGIN_UNSUPPORTED_PROTOCOLS = Object.freeze([]);

// ORD Resource Definition Types
const ORD_RESOURCE_DEFINITION_TYPE = Object.freeze({
    OPENAPI_V3: "openapi-v3",
    EDMX: "edmx",
    GRAPHQL_SDL: "graphql-sdl",
    ASYNCAPI_V2: "asyncapi-v2",
    CSN_INTEROP: "sap-csn-interop-effective-v1",
});

// Media Types for resource definitions
const ORD_MEDIA_TYPE = Object.freeze({
    JSON: "application/json",
    XML: "application/xml",
    TEXT_PLAIN: "text/plain",
});

// File extensions for resource definitions
const ORD_FILE_EXTENSION = Object.freeze({
    OAS3_JSON: "oas3.json",
    EDMX: "edmx",
    GRAPHQL: "graphql",
    ASYNCAPI2_JSON: "asyncapi2.json",
    CSN_JSON: "csn.json",
});

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
    CAP_TO_ORD_PROTOCOL_MAP,
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
    MCP_CUSTOM_TYPE,
    OPEN_RESOURCE_DISCOVERY_VERSION,
    OPENAPI_SERVERS_ANNOTATION,
    ORD_ACCESS_STRATEGY,
    ORD_API_PROTOCOL,
    ORD_DOCUMENT_FILE_NAME,
    ORD_EXTENSIONS_PREFIX,
    ORD_FILE_EXTENSION,
    ORD_MEDIA_TYPE,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    ORD_EXISTING_PRODUCT_PROPERTY,
    ORD_ONLY_PROTOCOLS,
    ORD_RESOURCE_DEFINITION_TYPE,
    ORD_RESOURCE_TYPE,
    ORD_SERVICE_NAME,
    PLUGIN_UNSUPPORTED_PROTOCOLS,
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
