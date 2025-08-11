const DefaultsProcessor = require("./defaultsProcessor");
const AnnotationsProcessor = require("./annotationsProcessor");
const { Logger } = require("../../logger");

class DataProductProcessorChain {
    constructor() {
        this.chain = this.buildChain();
    }

    buildChain() {
        const defaultsProcessor = new DefaultsProcessor();
        const annotationsProcessor = new AnnotationsProcessor();
        
        defaultsProcessor.setNext(annotationsProcessor);
        
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