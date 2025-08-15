const BaseProcessor = require("../../processors/baseProcessor");
const { Logger } = require("../../../logger");

class TaxonomyAnnotationsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { annotationReader } = context;
        Logger.info("TaxonomyAnnotationsProcessor: Applying taxonomy annotations to data products");
        
        const enrichedDataProducts = dataProducts.map(dataProduct => {
            const serviceName = dataProduct.serviceName;
            const updated = { ...dataProduct };
            
            // Use simplified API
            const industry = annotationReader.get(serviceName, 'industry');
            if (industry) {
                updated.industry = this.normalizeArray(industry);
            }
            
            const lineOfBusiness = annotationReader.get(serviceName, 'lineOfBusiness');
            if (lineOfBusiness) {
                updated.lineOfBusiness = this.normalizeArray(lineOfBusiness);
            }
            
            const countries = annotationReader.get(serviceName, 'countries');
            if (countries) {
                updated.countries = this.normalizeArray(countries);
            }
            
            const tags = annotationReader.get(serviceName, 'tags');
            if (tags) {
                updated.tags = this.normalizeArray(tags);
            }
            
            if (updated.industry || updated.lineOfBusiness || updated.countries || updated.tags) {
                Logger.info(`Applied taxonomy fields to ${serviceName}`);
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