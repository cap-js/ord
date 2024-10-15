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

const CONTENT_MERGE_KEY = 'ordId'

module.exports = {
    ORD_RESOURCE_TYPE,
    COMPILER_TYPES,
    CONTENT_MERGE_KEY
};
