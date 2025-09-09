const { Logger } = require("../../logger");
const DEFAULTS = require("../defaults");
const { validateTransformerV2Light } = require("./schemaValidator");
const { initTransformerV2Ajv, validateTransformerV2WithAjv } = require("./jsonSchemaValidator");
const { buildTransformerV2 } = require("./assembler");

function buildTransformerObject(config, csn, appConfig) {
    const { name, version, namespace, serviceName, transformerConfig = {} } = config;
    const defaults = DEFAULTS.transformer;

    // Build Transformer v2-compliant structure via SRP helpers
    const transformer = buildTransformerV2({
        serviceName,
        version,
        namespace,
        transformerConfig,
    }, defaults);

    // Kick-off Ajv compile in background (if available)
    try { initTransformerV2Ajv(); } catch (_) {}

    // Prefer Ajv validation if ready; fall back to light checks otherwise
    try {
        validateTransformerV2WithAjv(transformer);
    } catch (_) {
        try {
            validateTransformerV2Light(transformer);
        } catch (e2) {
            Logger.warn(`Transformer v2 schema (light) check: ${e2.message}`);
        }
    }

    Logger.info(`Built transformer object for ${serviceName}`);
    return transformer;
}

module.exports = {
    buildTransformerObject
};
