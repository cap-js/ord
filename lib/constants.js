const BUILD_DEFAULT_PATH = "gen/ord";

const ORD_ACCESS_STRATEGY = Object.freeze({
    Open: "open",
    Basic: "basic-auth",
    CmpMtls: "sap:cmp-mtls:v1",
    BahMtls: "sap.businesshub:mtls:v1",
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

const DATA_PRODUCT_ANNOTATION = "@DataIntegration.dataProduct.type";

const DATA_PRODUCT_SIMPLE_ANNOTATION = "@data.product";

const DATA_PRODUCT_TYPE = Object.freeze({
    primary: "primary",
});

const ENTITY_RELATIONSHIP_ANNOTATION = "@EntityRelationship.entityType";

const LEVEL = Object.freeze({
    aggregate: "aggregate",
    rootEntity: "root-entity",
    subEntity: "sub-entity",
});

const ORD_ODM_ENTITY_NAME_ANNOTATION = "@ODM.entityName";

const ORD_RESOURCE_TYPE = Object.freeze({
    api: "api",
    event: "event",
    entityType: "entityType",
    dataProduct: "dataProduct",
    integrationDependency: "integrationDependency",
});

const RESOURCE_VISIBILITY = Object.freeze({
    public: "public",
    internal: "internal",
    private: "private",
});

const SUPPORTED_IMPLEMENTATIONSTANDARD_VERSIONS = Object.freeze(["sap:ord-document-api:v1"]);

const SEM_VERSION_REGEX =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const EXTERNAL_DP_ORD_ID_ANNOTATION = "@cds.dp.ordId";

// ORD apiProtocol values
const ORD_API_PROTOCOL = Object.freeze({
    ODATA_V4: "odata-v4",
    ODATA_V2: "odata-v2",
    REST: "rest",
    GRAPHQL: "graphql",
    SAP_INA: "sap-ina-api-v1",
    SAP_DATA_SUBSCRIPTION: "sap.dp:data-subscription-api:v1",
    MCP: "mcp",
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
    ina: {
        apiProtocol: ORD_API_PROTOCOL.SAP_INA,
        hasEntryPoints: false,
        hasResourceDefinitions: false,
    },
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

// Authentication String Constants
const AUTH_STRINGS = Object.freeze({
    BASIC_PREFIX: "Basic ",
    WWW_AUTHENTICATE_REALM: 'Basic realm="401"',
});

const DOCUMENT_PERSPECTIVES = Object.freeze({
    SystemVersion: "system-version",
    SystemInstance: "system-instance",
});

const LOCAL_TENANT_ID_HEADER_KEY = "local-tenant-id";

module.exports = {
    BUILD_DEFAULT_PATH,
    CAP_TO_ORD_PROTOCOL_MAP,
    CDS_ELEMENT_KIND,
    CF_MTLS_HEADERS,
    DATA_PRODUCT_ANNOTATION,
    DATA_PRODUCT_SIMPLE_ANNOTATION,
    DATA_PRODUCT_TYPE,
    ENTITY_RELATIONSHIP_ANNOTATION,
    EXTERNAL_DP_ORD_ID_ANNOTATION,
    LEVEL,
    ORD_ACCESS_STRATEGY,
    ORD_API_PROTOCOL,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    ORD_ONLY_PROTOCOLS,
    ORD_RESOURCE_TYPE,
    RESOURCE_VISIBILITY,
    SUPPORTED_IMPLEMENTATIONSTANDARD_VERSIONS,
    SEM_VERSION_REGEX,
    CF_MTLS_ERROR_REASON,
    AUTH_STRINGS,
    DOCUMENT_PERSPECTIVES,
    LOCAL_TENANT_ID_HEADER_KEY,
};
