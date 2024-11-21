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

const OPEN_RESOURCE_DISCOVERY_VERSION = "1.9";

const ORD_EXTENSIONS_PREFIX = "@ORD.Extensions.";

const ORD_RESOURCE_TYPE = Object.freeze({
    api: "api",
    event: "event"
});

const RESOURCE_VISIBILITY = Object.freeze({
    public: "public",
    internal: "internal",
    private: "private",
});

const SHORT_DESCRIPTION_PREFIX = "Short description for ";

module.exports = {
    CDS_ELEMENT_KIND,
    COMPILER_TYPES,
    CONTENT_MERGE_KEY,
    DESCRIPTION_PREFIX,
    OPEN_RESOURCE_DISCOVERY_VERSION,
    ORD_EXTENSIONS_PREFIX,
    ORD_RESOURCE_TYPE,
    RESOURCE_VISIBILITY,
    SHORT_DESCRIPTION_PREFIX,
};
