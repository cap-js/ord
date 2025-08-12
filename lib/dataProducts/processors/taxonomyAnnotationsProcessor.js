const BaseProcessor = require("./baseProcessor");
const { Logger } = require("../../logger");

class TaxonomyAnnotationsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { annotationReader } = context;
        Logger.info("TaxonomyAnnotationsProcessor: Applying taxonomy annotations to data products");
        
        const enrichedDataProducts = dataProducts.map(dataProduct => {
            const annotations = annotationReader.get(dataProduct.serviceName);
            if (!annotations) {
                return dataProduct;
            }
            
            const updated = { ...dataProduct };
            
            // Check for taxonomy fields in annotations
            if (annotations.taxonomy) {
                const taxonomy = annotations.taxonomy;
                
                // Industry classification
                if (taxonomy.industry) {
                    updated.industry = this.normalizeArray(taxonomy.industry);
                }
                
                // Line of Business
                if (taxonomy.lineOfBusiness) {
                    updated.lineOfBusiness = this.normalizeArray(taxonomy.lineOfBusiness);
                }
                
                // Countries
                if (taxonomy.countries) {
                    updated.countries = this.normalizeArray(taxonomy.countries);
                }
                
                // Tags
                if (taxonomy.tags) {
                    updated.tags = this.normalizeArray(taxonomy.tags);
                }
            }
            
            // Also check for direct fields (from @ORD.Extensions or @ORD.dataProduct)
            if (annotations.industry) {
                updated.industry = this.normalizeArray(annotations.industry);
            }
            
            if (annotations.lineOfBusiness) {
                updated.lineOfBusiness = this.normalizeArray(annotations.lineOfBusiness);
            }
            
            if (annotations.countries) {
                updated.countries = this.normalizeArray(annotations.countries);
            }
            
            if (annotations.tags) {
                updated.tags = this.normalizeArray(annotations.tags);
            }
            
            if (updated.industry || updated.lineOfBusiness || updated.countries || updated.tags) {
                Logger.info(`Applied taxonomy fields to ${dataProduct.serviceName}`);
            }
            
            return updated;
        });
        
        return enrichedDataProducts;
    }
    
    normalizeArray(value) {
        if (Array.isArray(value)) {
            return value;
        }
        if (typeof value === 'string') {
            return [value];
        }
        return undefined;
    }
}

module.exports = TaxonomyAnnotationsProcessor;