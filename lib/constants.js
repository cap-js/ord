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

const SEM_VERSION_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const SHORT_DESCRIPTION_PREFIX = "Short description of ";

module.exports = {
    CDS_ELEMENT_KIND,
    COMPILER_TYPES,
    CONTENT_MERGE_KEY,
    DESCRIPTION_PREFIX,
    ENTITY_RELATIONSHIP_ANNOTATION,
    LEVEL,
    OPEN_RESOURCE_DISCOVERY_VERSION,
    ORD_EXTENSIONS_PREFIX,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    ORD_RESOURCE_TYPE,
    RESOURCE_VISIBILITY,
    SEM_VERSION_REGEX,
    SHORT_DESCRIPTION_PREFIX,
};
