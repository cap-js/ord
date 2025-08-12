const DefaultsProcessor = require("./defaultsProcessor");
const CoreAnnotationsProcessor = require("./coreAnnotationsProcessor");
const TaxonomyAnnotationsProcessor = require("./taxonomyAnnotationsProcessor");
const LifecycleAnnotationsProcessor = require("./lifecycleAnnotationsProcessor");
const EntityTypesProcessor = require("./entityTypesProcessor");
const { Logger } = require("../../logger");

class DataProductProcessorChain {
    constructor() {
        this.chain = this.buildChain();
    }

    buildChain() {
        const defaultsProcessor = new DefaultsProcessor();
        const coreAnnotationsProcessor = new CoreAnnotationsProcessor();
        const taxonomyAnnotationsProcessor = new TaxonomyAnnotationsProcessor();
        const lifecycleAnnotationsProcessor = new LifecycleAnnotationsProcessor();
        const entityTypesProcessor = new EntityTypesProcessor();
        
        defaultsProcessor
            .setNext(coreAnnotationsProcessor)
            .setNext(taxonomyAnnotationsProcessor)
            .setNext(lifecycleAnnotationsProcessor)
            .setNext(entityTypesProcessor);
        
        return defaultsProcessor;
    }

    process(context) {
        Logger.info("Starting data product processing chain");

        if (!context || !context.csn || !context.csn.definitions) {
            throw new Error("Invalid CSN: missing definitions");
        }

        const result = this.chain.handle([], context);

        Logger.info(`Completed processing ${result.length} data products`);
        return result;
    }
}

function createDataProductProcessor() {
    return new DataProductProcessorChain();
}

module.exports = {
    DataProductProcessorChain,
    createDataProductProcessor
};