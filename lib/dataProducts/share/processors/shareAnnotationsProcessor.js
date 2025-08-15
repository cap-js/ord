const BaseProcessor = require('../../processors/baseProcessor');
const { Logger } = require('../../../logger');

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
                const updated = { ...dataProduct };
                
                if (!updated.shareConfig) {
                    updated.shareConfig = {};
                }
                
                // Explicitly map only valid share configuration keys
                // Handle nested keys (e.g., 'extensible.supported') separately
                const validShareKeys = [
                    'isRuntimeExtensible',
                    'includeEntities',
                    'excludeEntities',
                    'columnMapping',
                    'typeMapping',
                    'includeManaged',
                    'includeVirtual',
                    'includeComputed'
                ];
                
                const validNestedKeys = [
                    'extensible.supported',
                    'extensible.description'
                ];
                
                let appliedCount = 0;
                
                // Process simple keys
                for (const key of validShareKeys) {
                    const value = shareAnnotationReader.get(serviceName, key);
                    if (value !== undefined) {
                        updated.shareConfig[key] = value;
                        appliedCount++;
                    }
                }
                
                // Process nested keys
                for (const key of validNestedKeys) {
                    const value = shareAnnotationReader.get(serviceName, key);
                    if (value !== undefined) {
                        const parts = key.split('.');
                        if (parts.length === 2) {
                            if (!updated.shareConfig[parts[0]]) {
                                updated.shareConfig[parts[0]] = {};
                            }
                            updated.shareConfig[parts[0]][parts[1]] = value;
                            appliedCount++;
                        }
                    }
                }
                
                if (appliedCount > 0) {
                    Logger.info(`Applied ${appliedCount} share annotations to ${serviceName}`);
                }
                
                return updated;
            } catch (error) {
                Logger.error(`Failed to process share annotations for ${dataProduct.serviceName}: ${error.message}`);
                // Return the dataProduct unchanged on error
                return dataProduct;
            }
        });
    }
}

module.exports = {
    ShareAnnotationsProcessor
};