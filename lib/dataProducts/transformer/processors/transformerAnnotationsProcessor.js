const BaseProcessor = require('../../processors/baseProcessor');
const { Logger } = require('../../../logger');

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
                const updated = { ...dataProduct };
                
                // Explicitly map only valid transformer configuration keys
                const validTransformerKeys = [
                    'name',
                    'dpdType',
                    'dpdVersion',
                    'stepKey',
                    'application',
                    'package',
                    'packageName',  // Alternative to 'package'
                    'packageVersion',
                    'entrypoint',
                    'entryPoint',  // Alternative to 'entrypoint'
                    'parameters',
                    'sparkVersion',
                    'driverMemory',
                    'executorMemory',
                    'cronSchedule',
                    'packages'
                ];
                
                // Check if any transformer annotations exist first
                let hasAnyAnnotations = false;
                for (const key of validTransformerKeys) {
                    const value = transformerAnnotationReader.get(serviceName, key);
                    if (value !== undefined) {
                        Logger.info(`Found transformer annotation for ${serviceName}: @transformer.${key} = ${value}`);
                        hasAnyAnnotations = true;
                        break;
                    }
                }
                
                // Only create config if annotations exist
                if (hasAnyAnnotations) {
                    updated.transformerConfig = {};
                    
                    let appliedCount = 0;
                    for (const key of validTransformerKeys) {
                        const value = transformerAnnotationReader.get(serviceName, key);
                        if (value !== undefined) {
                            // Handle alternative key names
                            if (key === 'packageName' && !updated.transformerConfig.package) {
                                updated.transformerConfig.package = value;
                            } else if (key === 'entryPoint' && !updated.transformerConfig.entrypoint) {
                                updated.transformerConfig.entrypoint = value;
                            } else {
                                updated.transformerConfig[key] = value;
                            }
                            appliedCount++;
                        }
                    }
                    
                    if (appliedCount > 0) {
                        Logger.info(`Applied ${appliedCount} transformer annotations to ${serviceName}`);
                    }
                }
                
                return updated;
            } catch (error) {
                Logger.error(`Failed to process transformer annotations for ${dataProduct.serviceName}: ${error.message}`);
                // Return the dataProduct unchanged on error
                return dataProduct;
            }
        });
    }
}

module.exports = {
    TransformerAnnotationsProcessor
};