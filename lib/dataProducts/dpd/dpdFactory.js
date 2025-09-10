const { compileValidator, validate } = require('../common/ajvValidator');
const { getDpdAnnotationConfig } = require('../config/configProvider');
const { loadSchemaWithFallback } = require('../common/schemaLoader');

let dpdInitPromise = null;

async function ensureDpdValidator() {
    if (dpdInitPromise) return dpdInitPromise;
    const cfg = getDpdAnnotationConfig();
    const localPath = require('path').join(__dirname, '..', 'config', 'schemas', cfg.schemaLocalFile);
    dpdInitPromise = loadSchemaWithFallback('dataproduct', cfg.schemaUrl, localPath)
        .then(res => {
            const v = compileValidator('dataproduct', res.schema);
            try {
                if (res.source === 'local') {
                    require('../../logger').Logger.warn('DataProduct schema: remote fetch failed, using local copy');
                }
            } catch (_) {}
            return v;
        })
        .catch(error => {
            // Schema loading failed completely
            console.error(`Failed to initialize DPD validator: ${error.message}`);
            return null;
        });
    return dpdInitPromise;
}

async function buildDpdObject(config, csn, appConfig) {
    const namespace = appConfig?.ordNamespace || "your.namespace";
    const dpName = config.name || config.serviceName || config.localId;
    
    // Clean up the config by removing empty configs
    const cleanConfig = { ...config };
    
    // Remove transformerConfig if it's empty or has only null values
    if (cleanConfig.transformerConfig) {
        const hasValidValues = Object.values(cleanConfig.transformerConfig).some(
            value => value !== null && value !== undefined
        );
        if (!hasValidValues) {
            delete cleanConfig.transformerConfig;
        }
    }
    
    // Remove shareConfig if it's empty or has only null values
    if (cleanConfig.shareConfig) {
        const hasValidValues = Object.entries(cleanConfig.shareConfig).some(
            ([key, value]) => {
                // Check nested extensible object separately
                if (key === 'extensible' && typeof value === 'object') {
                    return Object.values(value).some(v => v !== null && v !== undefined);
                }
                return value !== null && value !== undefined;
            }
        );
        if (!hasValidValues) {
            delete cleanConfig.shareConfig;
        }
    }
    
    // Remove csnConfig if it's empty or has only null values
    if (cleanConfig.csnConfig) {
        const hasValidValues = Object.values(cleanConfig.csnConfig).some(
            value => value !== null && value !== undefined
        );
        if (!hasValidValues) {
            delete cleanConfig.csnConfig;
        }
    }
    
    const result = {
        ...cleanConfig,
        name: dpName,
        namespace: namespace,
        ordId: `${namespace}:dataProduct:${dpName}:v1`
    };

    // Validate against DataProduct schema if ready (async init)
    try {
        await ensureDpdValidator();
        validate('dataproduct', result);
    } catch (error) {
        const { Logger } = require('../../logger');
        Logger.warn(`DPD validation skipped for ${dpName}: ${error.message || 'validator not ready'}`);
    }
    return result;
}

module.exports = {
    buildDpdObject
};
