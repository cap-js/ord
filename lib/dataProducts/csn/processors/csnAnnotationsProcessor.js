const BaseProcessor = require('../../processors/baseProcessor');
const { Logger } = require('../../../logger');

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
                const updated = { ...dataProduct };
                
                if (!updated.csnConfig) {
                    updated.csnConfig = {};
                }
                
                // Explicitly map only valid CSN configuration keys
                const validCsnKeys = [
                    'formatVersion',
                    'id',
                    'creator',
                    'includeMetadata',
                    'includeAnnotations',
                    'includeAbstract',
                    'includePrivate',
                    'pruneUnused',
                    'flattenAssociations',
                    'expandStructures',
                    'includeVirtual',
                    'includeComputed'
                ];
                
                let appliedCount = 0;
                for (const key of validCsnKeys) {
                    const value = csnAnnotationReader.get(serviceName, key);
                    // Only add if value is defined (allows false, 0, empty string but not null/undefined)
                    if (value !== undefined) {
                        updated.csnConfig[key] = value;
                        appliedCount++;
                    }
                }
                
                if (appliedCount > 0) {
                    Logger.info(`Applied ${appliedCount} CSN annotations to ${serviceName}`);
                }
                
                return updated;
            } catch (error) {
                Logger.error(`Failed to process CSN annotations for ${dataProduct.serviceName}: ${error.message}`);
                // Return the dataProduct unchanged on error
                return dataProduct;
            }
        });
    }
}

module.exports = {
    CsnAnnotationsProcessor
};