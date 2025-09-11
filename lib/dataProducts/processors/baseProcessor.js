const { Logger } = require("../../logger");

class BaseProcessor {
    constructor() {
        this.next = null;
    }

    setNext(processor) {
        this.next = processor;
        return processor;
    }

    async process(dataProducts, context) {
        throw new Error("Process method must be implemented by subclass");
    }

    async handle(dataProducts, context) {
        const result = await this.process(dataProducts, context);

        if (this.next) {
            return await this.next.handle(result, context);
        }

        return result;
    }
}

module.exports = BaseProcessor;