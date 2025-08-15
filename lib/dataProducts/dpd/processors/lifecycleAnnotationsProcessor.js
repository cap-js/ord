const BaseProcessor = require("../../processors/baseProcessor");
const { Logger } = require("../../../logger");

class LifecycleAnnotationsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { annotationReader } = context;
        Logger.info("LifecycleAnnotationsProcessor: Applying lifecycle annotations to data products");
        
        const enrichedDataProducts = dataProducts.map(dataProduct => {
            const serviceName = dataProduct.serviceName;
            const updated = { ...dataProduct };
            
            // Use simplified API
            const releaseStatus = annotationReader.get(serviceName, 'releaseStatus');
            if (releaseStatus) {
                updated.releaseStatus = this.validateReleaseStatus(releaseStatus);
            }
            
            const deprecationDate = annotationReader.get(serviceName, 'deprecationDate');
            if (deprecationDate) {
                updated.deprecationDate = this.validateDate(deprecationDate);
            }
            
            const sunsetDate = annotationReader.get(serviceName, 'sunsetDate');
            if (sunsetDate) {
                updated.sunsetDate = this.validateDate(sunsetDate);
            }
            
            const lastUpdate = annotationReader.get(serviceName, 'lastUpdate');
            if (lastUpdate) {
                updated.lastUpdate = this.validateDate(lastUpdate);
            }
            
            if (updated.releaseStatus || updated.deprecationDate || updated.sunsetDate || updated.lastUpdate) {
                Logger.info(`Applied lifecycle fields to ${serviceName}`);
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