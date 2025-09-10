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
    try { 
        initTransformerV2Ajv(); 
    } catch (initError) {
        // Ajv initialization failed - likely not installed or config issue
        Logger.debug(`Transformer Ajv init skipped: ${initError.message}`);
    }

    // Prefer Ajv validation if ready; fall back to light checks otherwise
    try {
        validateTransformerV2WithAjv(transformer);
    } catch (ajvError) {
        // Ajv validation failed or not ready, try light validation
        Logger.debug(`Transformer Ajv validation failed for ${serviceName}: ${ajvError.message}, falling back to light validation`);
        try {
            validateTransformerV2Light(transformer);
        } catch (lightError) {
            Logger.warn(`Transformer v2 schema validation failed for ${serviceName}: ${lightError.message}`);
        }
    }

    Logger.info(`Built transformer object for ${serviceName}`);
    return transformer;
}

module.exports = {
    buildTransformerObject
};
