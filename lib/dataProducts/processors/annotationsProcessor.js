const BaseProcessor = require("./baseProcessor");
const { Logger } = require("../../logger");

class AnnotationsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { csn } = context;
        Logger.info("AnnotationsProcessor: Applying annotations to data products");
        
        const annotatedDataProducts = dataProducts.map(dataProduct => {
            const service = csn.definitions[dataProduct.serviceName];
            if (!service || !service['@ORD.dataProduct']) {
                return dataProduct;
            }
            
            const annotation = service['@ORD.dataProduct'];
            const updated = { ...dataProduct };
            
            if (annotation.title) updated.title = annotation.title;
            if (annotation.description) updated.description = annotation.description;
            if (annotation.version) updated.version = annotation.version;
            if (annotation.type) updated.type = annotation.type;
            if (annotation.visibility) updated.visibility = annotation.visibility;
            
            Logger.info(`Applied annotations to ${dataProduct.serviceName}`);
            return updated;
        });
        
        return annotatedDataProducts;
    }
}

module.exports = AnnotationsProcessor;