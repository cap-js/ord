const AUTHENTICATION_TYPE = Object.freeze({
    Open: "open",
    Basic: "basic",
    UclMtls: "ucl-mtls",
});

const BASIC_AUTH_HEADER_KEY = "authorization";

const ORD_ACCESS_STRATEGY = Object.freeze({
    Open: "open",
    Basic: "sap.businesshub:basic-auth:v1",
    UclMtls: "sap:cmp-mtls:v1",
});

const AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP = Object.freeze({
    [AUTHENTICATION_TYPE.Open]: ORD_ACCESS_STRATEGY.Open,
    [AUTHENTICATION_TYPE.Basic]: ORD_ACCESS_STRATEGY.Basic,
    [AUTHENTICATION_TYPE.UclMtls]: ORD_ACCESS_STRATEGY.UclMtls,
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

const CERT_SUBJECT_HEADER_KEY = "x-ssl-client-subject-dn";

const COMPILER_TYPES = Object.freeze({
    oas3: "oas3",
    asyncapi2: "asyncapi2",
    edmx: "edmx",
});

const CONTENT_MERGE_KEY = "ordId";

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

const ORD_RESOURCE_TYPE = Object.freeze({
    api: "api",
    event: "event",
    integrationDependency: "integrationDependency",
    entityType: "entityType",
});

const RESOURCE_VISIBILITY = Object.freeze({
    public: "public",
    internal: "internal",
    private: "private",
});

const SHORT_DESCRIPTION_PREFIX = "Short description of ";

const SEM_VERSION_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

module.exports = {
    AUTHENTICATION_TYPE,
    AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP,
    BASIC_AUTH_HEADER_KEY,
    CDS_ELEMENT_KIND,
    CERT_SUBJECT_HEADER_KEY,
    COMPILER_TYPES,
    CONTENT_MERGE_KEY,
    DESCRIPTION_PREFIX,
    ENTITY_RELATIONSHIP_ANNOTATION,
    LEVEL,
    OPEN_RESOURCE_DISCOVERY_VERSION,
    ORD_ACCESS_STRATEGY,
    ORD_EXTENSIONS_PREFIX,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    ORD_RESOURCE_TYPE,
    RESOURCE_VISIBILITY,
    SHORT_DESCRIPTION_PREFIX,
    SEM_VERSION_REGEX
};
