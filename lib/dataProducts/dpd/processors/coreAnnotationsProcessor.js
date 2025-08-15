const BaseProcessor = require("../../processors/baseProcessor");
const { Logger } = require("../../../logger");

class CoreAnnotationsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { annotationReader } = context;
        Logger.info("CoreAnnotationsProcessor: Applying core annotations to data products");
        
        const annotatedDataProducts = dataProducts.map(dataProduct => {
            const serviceName = dataProduct.serviceName;
            const updated = { ...dataProduct };
            
            // Use simplified API - just ask for the property name
            const name = annotationReader.get(serviceName, 'name');
            if (name) updated.name = name;
            
            const version = annotationReader.get(serviceName, 'version');
            if (version) updated.version = version;
            
            const title = annotationReader.get(serviceName, 'title');
            if (title) updated.title = title;
            
            const description = annotationReader.get(serviceName, 'description');
            if (description) updated.description = description;
            
            const shortDescription = annotationReader.get(serviceName, 'shortDescription');
            if (shortDescription) updated.shortDescription = shortDescription;
            
            const type = annotationReader.get(serviceName, 'type');
            if (type) updated.type = type;
            
            const visibility = annotationReader.get(serviceName, 'visibility');
            if (visibility) updated.visibility = visibility;
            
            if (updated.version && updated.name) {
                updated.ordId = `${updated.namespace}:dataProduct:${updated.name}:v${updated.version}`;
            }
            
            if (name || version || title) {
                Logger.info(`Applied annotations to ${serviceName}`);
            }
            
            return updated;
        });
        
        return annotatedDataProducts;
    }
}

module.exports = CoreAnnotationsProcessor;