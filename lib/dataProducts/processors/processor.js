const DefaultsProcessor = require("../dpd/processors/defaultsProcessor");
const CoreAnnotationsProcessor = require("../dpd/processors/coreAnnotationsProcessor");
const TaxonomyAnnotationsProcessor = require("../dpd/processors/taxonomyAnnotationsProcessor");
const LifecycleAnnotationsProcessor = require("../dpd/processors/lifecycleAnnotationsProcessor");
const EntityTypesProcessor = require("../dpd/processors/entityTypesProcessor");
const { TransformerAnnotationsProcessor } = require("../transformer/processors/transformerAnnotationsProcessor");
const { ShareAnnotationsProcessor } = require("../share/processors/shareAnnotationsProcessor");
const { CsnAnnotationsProcessor } = require("../csn/processors/csnAnnotationsProcessor");
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
        const transformerAnnotationsProcessor = new TransformerAnnotationsProcessor();
        const shareAnnotationsProcessor = new ShareAnnotationsProcessor();
        const csnAnnotationsProcessor = new CsnAnnotationsProcessor();
        
        defaultsProcessor
            .setNext(coreAnnotationsProcessor)
            .setNext(taxonomyAnnotationsProcessor)
            .setNext(lifecycleAnnotationsProcessor)
            .setNext(entityTypesProcessor)
            .setNext(transformerAnnotationsProcessor)
            .setNext(shareAnnotationsProcessor)
            .setNext(csnAnnotationsProcessor);
        
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