const BaseProcessor = require('../../processors/baseProcessor');
const { Logger } = require('../../../logger');
const { applyBucketAnnotations } = require('../../utils/bucketAnnotationUtil');
const { getCsnAnnotationConfig } = require('../../config/configProvider');
const { getEffectiveAllowlistSync } = require('../../common/schemaAllowlistService');

class CsnAnnotationsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { csnAnnotationReader } = context;
        
        if (!csnAnnotationReader) {
            Logger.warn("CsnAnnotationsProcessor: No csnAnnotationReader in context");
            return dataProducts;
        }
        
        Logger.info("CsnAnnotationsProcessor: Processing CSN annotations");
        
        return dataProducts.map(dataProduct => {
            try {
                const serviceName = dataProduct.serviceName;
                const cfg = getCsnAnnotationConfig ? getCsnAnnotationConfig() : { allow: '*', allowedPrefixes: [] };
                const all = csnAnnotationReader.getAll(serviceName) || {};
                const effectiveAllow = getEffectiveAllowlistSync('csn', Object.keys(all));

                const merged = applyBucketAnnotations(serviceName, csnAnnotationReader, {
                    target: 'csnConfig',
                    allow: effectiveAllow,
                    nestedPaths: true,
                });

                if (Object.keys(merged).length === 0) return dataProduct;
                const updated = { ...dataProduct, ...merged };
                Logger.info(`Applied CSN annotations to ${serviceName}`);
                return updated;
            } catch (error) {
                Logger.error(`Failed to process CSN annotations for ${dataProduct.serviceName}: ${error.message}`);
                return dataProduct;
            }
        });
    }
}

module.exports = {
    CsnAnnotationsProcessor
};
