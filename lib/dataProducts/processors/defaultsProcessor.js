const BaseProcessor = require("./baseProcessor");
const { Logger } = require("../../logger");

class DefaultsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { annotationReader } = context;
        Logger.info("DefaultsProcessor: Creating default data products for services with annotations");

        const defaultDataProducts = [];

        for (const serviceName of annotationReader.getAllServices()) {
            const dataProduct = this.initDataProductObj(serviceName);
            defaultDataProducts.push(dataProduct);
        }

        Logger.info(`DefaultsProcessor: Created ${defaultDataProducts.length} default data products`);
        return defaultDataProducts;
    }

    initDataProductObj(serviceName) {
        // we can change the default values here.
        return {
            serviceName: serviceName,
            name: serviceName,
            title: serviceName,
            version: "1.0.0",
            type: "primary",
            visibility: "internal",
            description: ""
        };
    }
}

module.exports = DefaultsProcessor;
