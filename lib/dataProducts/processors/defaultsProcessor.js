const BaseProcessor = require("./baseProcessor");
const { Logger } = require("../../logger");

class DefaultsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { csn } = context;
        Logger.info("DefaultsProcessor: Creating default data products for services with annotations");

        const defaultDataProducts = [];

        Object.entries(csn.definitions).forEach(([name, definition]) => {
            if (definition.kind === "service" && definition['@ORD.dataProduct']) {
                const dataProduct = this.initDataProductObj(name);
                defaultDataProducts.push(dataProduct);
            }
        });

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
