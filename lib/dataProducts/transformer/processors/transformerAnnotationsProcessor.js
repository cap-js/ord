const BaseProcessor = require('../../processors/baseProcessor');
const { Logger } = require('../../../logger');
const { applyBucketAnnotations } = require('../../utils/bucketAnnotationUtil');
const { getTransformerAnnotationConfig } = require('../../config/configProvider');
const { getEffectiveAllowlistSync } = require('../../common/schemaAllowlistService');
const { resolveNormalizersMap, arrayify } = require('../../utils/normalizers');

class TransformerAnnotationsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { transformerAnnotationReader } = context;
        
        if (!transformerAnnotationReader) {
            Logger.warn("TransformerAnnotationsProcessor: No transformerAnnotationReader in context");
            return dataProducts;
        }
        
        Logger.info("TransformerAnnotationsProcessor: Processing transformer annotations");
        
        return dataProducts.map(dataProduct => {
            try {
                const serviceName = dataProduct.serviceName;

                // Load config and get effective allowlist
                const cfg = getTransformerAnnotationConfig();
                const all = transformerAnnotationReader.getAll(serviceName) || {};
                const dynamicAllowedArr = getEffectiveAllowlistSync('transformer', Object.keys(all));
                const dynamicAllowed = new Set(dynamicAllowedArr);

                // Warn on unknown keys
                for (const k of Object.keys(all)) {
                    if (!dynamicAllowed.has(k)) {
                        Logger.warn(`@transformer annotation ignored (not in schema allowlist): ${serviceName} -> '${k}'`);
                    }
                }

                // Merge filtered transformer keys with aliases and normalizers (config overlays built-ins)
                const baseAlias = {
                    packageName: 'package',
                    entryPoint: 'entrypoint',
                    'spark.version': 'sparkVersion',
                    'spark.packages': 'packages',
                    'spark.driverMemory': 'driverMemory',
                    'spark.executorMemory': 'executorMemory',
                    cron: 'cronSchedule',
                };
                const alias = { ...baseAlias, ...(cfg.alias || {}) };
                const baseNormalizers = { packages: arrayify };
                const normalizers = { ...baseNormalizers, ...resolveNormalizersMap(cfg.normalizers) };

                const merged = applyBucketAnnotations(serviceName, transformerAnnotationReader, {
                    target: 'transformerConfig',
                    allow: Array.from(dynamicAllowed),
                    alias,
                    normalizers,
                    nestedPaths: true,
                });

                if (Object.keys(merged).length === 0) return dataProduct;
                const updated = { ...dataProduct, ...merged };
                Logger.info(`Applied transformer annotations to ${serviceName}`);
                return updated;
            } catch (error) {
                Logger.error(`Failed to process transformer annotations for ${dataProduct.serviceName}: ${error.message}`);
                return dataProduct;
            }
        });
    }
}

module.exports = {
    TransformerAnnotationsProcessor
};
