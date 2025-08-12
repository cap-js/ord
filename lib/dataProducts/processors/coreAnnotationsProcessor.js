const BaseProcessor = require("./baseProcessor");
const { Logger } = require("../../logger");

class CoreAnnotationsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { annotationReader } = context;
        Logger.info("CoreAnnotationsProcessor: Applying core annotations to data products");
        
        const annotatedDataProducts = dataProducts.map(dataProduct => {
            const annotations = annotationReader.get(dataProduct.serviceName);
            if (!annotations) {
                return dataProduct;
            }
            
            const updated = { ...dataProduct };
            
            if (annotations.title) updated.title = annotations.title;
            if (annotations.description) updated.description = annotations.description;
            if (annotations.version) updated.version = annotations.version;
            if (annotations.type) updated.type = annotations.type;
            if (annotations.visibility) updated.visibility = annotations.visibility;
            
            Logger.info(`Applied annotations to ${dataProduct.serviceName}`);
            return updated;
        });
        
        return annotatedDataProducts;
    }
}

module.exports = CoreAnnotationsProcessor;