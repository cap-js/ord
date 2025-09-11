const BaseProcessor = require('../../processors/baseProcessor');
const { Logger } = require('../../../logger');
const { applyBucketAnnotations } = require('../../utils/bucketAnnotationUtil');
const { getCsnAnnotationConfig } = require('../../config/configProvider');
const { getEffectiveAllowlist } = require('../../common/schemaAllowlistService');
const { resolveNormalizersMap } = require('../../utils/normalizers');

class CsnAnnotationsProcessor extends BaseProcessor {
    async process(dataProducts, context) {
        const { csnAnnotationReader } = context;
        
        if (!csnAnnotationReader) {
            Logger.warn("CsnAnnotationsProcessor: No csnAnnotationReader in context");
            return dataProducts;
        }
        
        Logger.info("CsnAnnotationsProcessor: Processing CSN annotations");
        
        const processedProducts = [];
        
        for (const dataProduct of dataProducts) {
            try {
                const serviceName = dataProduct.serviceName;
                const cfg = getCsnAnnotationConfig ? getCsnAnnotationConfig() : { allowlistMode: 'dynamic', allowlist: [], allowedPrefixes: [] };
                const all = csnAnnotationReader.getAll(serviceName) || {};
                const effectiveAllow = await getEffectiveAllowlist('csn', Object.keys(all));

                // Get aliases and normalizers from config
                const alias = cfg.alias || {};
                const normalizers = resolveNormalizersMap(cfg.normalizers || {});

                const merged = applyBucketAnnotations(serviceName, csnAnnotationReader, {
                    target: 'csnConfig',
                    allow: effectiveAllow,
                    alias,
                    normalizers,
                    nestedPaths: true,
                });

                if (Object.keys(merged).length === 0) {
                    processedProducts.push(dataProduct);
                } else {
                    const updated = { ...dataProduct, ...merged };
                    Logger.info(`Applied CSN annotations to ${serviceName}`);
                    processedProducts.push(updated);
                }
            } catch (error) {
                Logger.error(`Failed to process CSN annotations for ${dataProduct.serviceName}: ${error.message}`);
                processedProducts.push(dataProduct);
            }
        }
        
        return processedProducts;
    }
}

module.exports = {
    CsnAnnotationsProcessor
};
