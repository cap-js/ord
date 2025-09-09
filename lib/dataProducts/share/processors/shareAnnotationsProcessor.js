const BaseProcessor = require('../../processors/baseProcessor');
const { Logger } = require('../../../logger');
const { applyBucketAnnotations } = require('../../utils/bucketAnnotationUtil');
const { getShareAnnotationConfig } = require('../../config/configProvider');
const { resolveNormalizersMap, arrayify } = require('../../utils/normalizers');
const { getEffectiveAllowlistSync } = require('../../common/schemaAllowlistService');

class ShareAnnotationsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { shareAnnotationReader } = context;
        
        if (!shareAnnotationReader) {
            Logger.warn("ShareAnnotationsProcessor: No shareAnnotationReader in context");
            return dataProducts;
        }
        
        Logger.info("ShareAnnotationsProcessor: Processing share annotations");
        
        return dataProducts.map(dataProduct => {
            try {
                const serviceName = dataProduct.serviceName;

                const cfg = getShareAnnotationConfig();
                const all = shareAnnotationReader.getAll(serviceName) || {};

                // Build effective allowlist using common service
                const dynamicAllowedArr = getEffectiveAllowlistSync('share', Object.keys(all));
                const dynamicAllowed = new Set(dynamicAllowedArr);

                const baseAlias = {
                    'entities.include': 'includeEntities',
                    'entities.exclude': 'excludeEntities',
                    'columns.map': 'columnMapping',
                    'types.map': 'typeMapping',
                    'flags.includeManaged': 'includeManaged',
                    'flags.includeVirtual': 'includeVirtual',
                    'flags.includeComputed': 'includeComputed',
                };
                const alias = { ...baseAlias, ...(cfg.alias || {}) };
                const baseNormalizers = { includeEntities: arrayify, excludeEntities: arrayify };
                const normalizers = { ...baseNormalizers, ...resolveNormalizersMap(cfg.normalizers) };

                // Merge filtered share keys with aliases and normalizers
                const merged = applyBucketAnnotations(serviceName, shareAnnotationReader, {
                    target: 'shareConfig',
                    allow: Array.from(dynamicAllowed),
                    nestedPaths: true,
                    alias,
                    normalizers,
                });

                if (Object.keys(merged).length === 0) return dataProduct;
                const updated = { ...dataProduct, ...merged };
                Logger.info(`Applied share annotations to ${serviceName}`);
                return updated;
            } catch (error) {
                Logger.error(`Failed to process share annotations for ${dataProduct.serviceName}: ${error.message}`);
                return dataProduct;
            }
        });
    }
}

module.exports = {
    ShareAnnotationsProcessor
};
