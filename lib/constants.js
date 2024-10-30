const ORD_RESOURCE_TYPE = Object.freeze(
    {
        "service": "service",
        "entity": "entity",
        "event": "event",
        "api": "api"
    });

const COMPILER_TYPES = Object.freeze(
    {
        "oas3": "oas3",
        "asyncapi2": "asyncapi2",
        "edmx": "edmx"
    });

const CONTENT_MERGE_KEY = "ordId";

const ORD_EXTENSIONS_PREFIX = "@ORD.Extensions.";

const OPEN_RESOURCE_DISCOVERY_VERSION = "1.9";

module.exports = {
    ORD_RESOURCE_TYPE,
    COMPILER_TYPES,
    CONTENT_MERGE_KEY,
    ORD_EXTENSIONS_PREFIX,
    OPEN_RESOURCE_DISCOVERY_VERSION
};
