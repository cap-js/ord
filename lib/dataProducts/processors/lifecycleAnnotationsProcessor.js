const BaseProcessor = require("./baseProcessor");
const { Logger } = require("../../logger");

class LifecycleAnnotationsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { annotationReader } = context;
        Logger.info("LifecycleAnnotationsProcessor: Applying lifecycle annotations to data products");
        
        const enrichedDataProducts = dataProducts.map(dataProduct => {
            const annotations = annotationReader.get(dataProduct.serviceName);
            if (!annotations) {
                return dataProduct;
            }
            
            const updated = { ...dataProduct };
            
            // Check for lifecycle fields in annotations
            if (annotations.lifecycle) {
                const lifecycle = annotations.lifecycle;
                
                // Release status
                if (lifecycle.releaseStatus) {
                    updated.releaseStatus = this.validateReleaseStatus(lifecycle.releaseStatus);
                }
                
                // Deprecation date
                if (lifecycle.deprecationDate) {
                    updated.deprecationDate = this.validateDate(lifecycle.deprecationDate);
                }
                
                // Sunset date
                if (lifecycle.sunsetDate) {
                    updated.sunsetDate = this.validateDate(lifecycle.sunsetDate);
                }
                
                // Last update
                if (lifecycle.lastUpdate) {
                    updated.lastUpdate = this.validateDate(lifecycle.lastUpdate);
                }
            }
            
            // Also check for direct lifecycle fields in annotations
            if (annotations.releaseStatus) {
                updated.releaseStatus = this.validateReleaseStatus(annotations.releaseStatus);
            }
            
            if (annotations.deprecationDate) {
                updated.deprecationDate = this.validateDate(annotations.deprecationDate);
            }
            
            if (annotations.sunsetDate) {
                updated.sunsetDate = this.validateDate(annotations.sunsetDate);
            }
            
            if (annotations.lastUpdate) {
                updated.lastUpdate = this.validateDate(annotations.lastUpdate);
            }
            
            if (updated.releaseStatus || updated.deprecationDate || updated.sunsetDate || updated.lastUpdate) {
                Logger.info(`Applied lifecycle fields to ${dataProduct.serviceName}`);
            }
            
            return updated;
        });
        
        return enrichedDataProducts;
    }
    
    validateReleaseStatus(status) {
        const validStatuses = ['beta', 'active', 'deprecated', 'decommissioned'];
        if (typeof status === 'string' && validStatuses.includes(status.toLowerCase())) {
            return status.toLowerCase();
        }
        Logger.warn(`Invalid release status: ${status}. Using 'active' as default.`);
        return 'active';
    }
    
    validateDate(date) {
        if (!date) return undefined;
        
        // Accept various date formats
        if (typeof date === 'string') {
            // Basic validation - should be ISO date format YYYY-MM-DD or datetime
            const datePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
            if (datePattern.test(date)) {
                return date;
            }
            
            // Try to parse and reformat
            try {
                const parsedDate = new Date(date);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
                }
            } catch (e) {
                Logger.warn(`Invalid date format: ${date}`);
            }
        }
        
        return undefined;
    }
}

module.exports = LifecycleAnnotationsProcessor;