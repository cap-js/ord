const Logger = require("../logger");
const {
    ALLOWED_VISIBILITY,
    RESOURCE_VISIBILITY,
    SUPPORTED_IMPLEMENTATIONSTANDARD_VERSIONS,
    DATA_PRODUCT_ANNOTATION,
    DATA_PRODUCT_SIMPLE_ANNOTATION,
    DATA_PRODUCT_TYPE,
} = require("../constants");

function determineVisibility(extensions, definition, config) {
    let defaultVisibility = config.env?.defaultVisibility || RESOURCE_VISIBILITY.public;

    if (!ALLOWED_VISIBILITY.includes(defaultVisibility)) {
        Logger.warn(
            "Default visibility",
            defaultVisibility,
            "is not supported. Using",
            RESOURCE_VISIBILITY.public,
            "as fallback.",
        );
        defaultVisibility = RESOURCE_VISIBILITY.public;
    }

    if (isPrimaryDataProductService(definition)) return RESOURCE_VISIBILITY.internal;
    if (extensions.visibility) return extensions.visibility;
    if (definition["@ORD.Extensions.visibility"]) return definition["@ORD.Extensions.visibility"];
    if (SUPPORTED_IMPLEMENTATIONSTANDARD_VERSIONS.includes(extensions.implementationStandard))
        return RESOURCE_VISIBILITY.public;
    return defaultVisibility;
}

function isPrimaryDataProductService(definition) {
    return (
        definition[DATA_PRODUCT_ANNOTATION] === DATA_PRODUCT_TYPE.primary ||
        !!definition[DATA_PRODUCT_SIMPLE_ANNOTATION]
    );
}

module.exports = { determineVisibility, isPrimaryDataProductService };
