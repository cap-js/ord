const BaseProcessor = require('../../processors/baseProcessor');
const { Logger } = require('../../../logger');
const { applyBucketAnnotations } = require('../../utils/bucketAnnotationUtil');
const { getTransformerAnnotationConfig } = require('../../config/configProvider');
const { getEffectiveAllowlist } = require('../../common/schemaAllowlistService');
const { resolveNormalizersMap } = require('../../utils/normalizers');

class TransformerAnnotationsProcessor extends BaseProcessor {
    async process(dataProducts, context) {
        const { transformerAnnotationReader } = context;
        
        if (!transformerAnnotationReader) {
            Logger.warn("TransformerAnnotationsProcessor: No transformerAnnotationReader in context");
            return dataProducts;
        }
        
        Logger.info("TransformerAnnotationsProcessor: Processing transformer annotations");
        
        const processedProducts = [];
        
        for (const dataProduct of dataProducts) {
            try {
                const serviceName = dataProduct.serviceName;

                // Load config and get effective allowlist
                const cfg = getTransformerAnnotationConfig();
                const all = transformerAnnotationReader.getAll(serviceName) || {};
                const effectiveAllowlist = await getEffectiveAllowlist('transformer', Object.keys(all));

                // Warn on unknown keys
                for (const k of Object.keys(all)) {
                    if (!effectiveAllowlist.includes(k)) {
                        Logger.warn(`@transformer annotation ignored (not in allowlist): ${serviceName} -> '${k}'`);
                    }
                }

                // Get aliases and normalizers from config
                const alias = cfg.alias || {};
                const normalizers = resolveNormalizersMap(cfg.normalizers || {});

                const merged = applyBucketAnnotations(serviceName, transformerAnnotationReader, {
                    target: 'transformerConfig',
                    allow: effectiveAllowlist,
                    alias,
                    normalizers,
                    nestedPaths: true,
                });

                if (Object.keys(merged).length === 0) {
                    processedProducts.push(dataProduct);
                } else {
                    const updated = { ...dataProduct, ...merged };
                    Logger.info(`Applied transformer annotations to ${serviceName}`);
                    processedProducts.push(updated);
                }
            } catch (error) {
                Logger.error(`Failed to process transformer annotations for ${dataProduct.serviceName}: ${error.message}`);
                processedProducts.push(dataProduct);
            }
        }
        
        return processedProducts;
    }
}

module.exports = {
    TransformerAnnotationsProcessor
};
