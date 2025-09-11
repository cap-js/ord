const BaseProcessor = require('../../processors/baseProcessor');
const { Logger } = require('../../../logger');
const { applyBucketAnnotations } = require('../../utils/bucketAnnotationUtil');
const { getShareAnnotationConfig } = require('../../config/configProvider');
const { resolveNormalizersMap } = require('../../utils/normalizers');
const { getEffectiveAllowlist } = require('../../common/schemaAllowlistService');

class ShareAnnotationsProcessor extends BaseProcessor {
    async process(dataProducts, context) {
        const { shareAnnotationReader } = context;
        
        if (!shareAnnotationReader) {
            Logger.warn("ShareAnnotationsProcessor: No shareAnnotationReader in context");
            return dataProducts;
        }
        
        Logger.info("ShareAnnotationsProcessor: Processing share annotations");
        
        const processedProducts = [];
        
        for (const dataProduct of dataProducts) {
            try {
                const serviceName = dataProduct.serviceName;

                const cfg = getShareAnnotationConfig();
                const all = shareAnnotationReader.getAll(serviceName) || {};

                // Build effective allowlist using common service
                const effectiveAllowlist = await getEffectiveAllowlist('share', Object.keys(all));

                // Get aliases and normalizers from config
                const alias = cfg.alias || {};
                const normalizers = resolveNormalizersMap(cfg.normalizers || {});

                // Merge filtered share keys with aliases and normalizers
                const merged = applyBucketAnnotations(serviceName, shareAnnotationReader, {
                    target: 'shareConfig',
                    allow: effectiveAllowlist,
                    nestedPaths: true,
                    alias,
                    normalizers,
                });

                if (Object.keys(merged).length === 0) {
                    processedProducts.push(dataProduct);
                } else {
                    const updated = { ...dataProduct, ...merged };
                    Logger.info(`Applied share annotations to ${serviceName}`);
                    processedProducts.push(updated);
                }
            } catch (error) {
                Logger.error(`Failed to process share annotations for ${dataProduct.serviceName}: ${error.message}`);
                processedProducts.push(dataProduct);
            }
        }
        
        return processedProducts;
    }
}

module.exports = {
    ShareAnnotationsProcessor
};
