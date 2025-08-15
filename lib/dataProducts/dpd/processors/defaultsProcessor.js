const BaseProcessor = require("../../processors/baseProcessor");
const { Logger } = require("../../../logger");
const DEFAULTS = require("../../defaults");

class DefaultsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { annotationReader } = context;
        Logger.info("DefaultsProcessor: Creating default data products for services with annotations");

        const defaultDataProducts = [];

        for (const serviceName of annotationReader.getDataProducts()) {
            const dataProduct = this.initDataProductObj(serviceName);
            defaultDataProducts.push(dataProduct);
        }

        Logger.info(`DefaultsProcessor: Created ${defaultDataProducts.length} default data products`);
        return defaultDataProducts;
    }

    initDataProductObj(serviceName) {
        const dpdDefaults = DEFAULTS.dpd;
        
        return {
            serviceName: serviceName,
            name: serviceName,
            title: serviceName,
            version: dpdDefaults.version,
            type: dpdDefaults.type,
            visibility: dpdDefaults.visibility,
            releaseStatus: dpdDefaults.releaseStatus,
            description: ""
        };
    }
}

module.exports = DefaultsProcessor;