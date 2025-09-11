const BaseProcessor = require('../../../../lib/dataProducts/processors/baseProcessor');

describe('BaseProcessor', () => {
    let processor;

    beforeEach(() => {
        processor = new BaseProcessor();
    });

    describe('constructor', () => {
        it('should initialize with next as null', () => {
            expect(processor.next).toBeNull();
        });
    });

    describe('setNext', () => {
        it('should set the next processor and return it', () => {
            const nextProcessor = new BaseProcessor();
            const result = processor.setNext(nextProcessor);
            
            expect(processor.next).toBe(nextProcessor);
            expect(result).toBe(nextProcessor);
        });

        it('should allow chaining of processors', () => {
            const processor2 = new BaseProcessor();
            const processor3 = new BaseProcessor();
            
            processor.setNext(processor2).setNext(processor3);
            
            expect(processor.next).toBe(processor2);
            expect(processor2.next).toBe(processor3);
            expect(processor3.next).toBeNull();
        });
    });

    describe('process', () => {
        it('should throw error when called on base class', async () => {
            await expect(processor.process([], {})).rejects.toThrow(
                'Process method must be implemented by subclass'
            );
        });
    });

    describe('handle', () => {
        it('should call process and return result when no next processor', async () => {
            // Create a mock processor that extends BaseProcessor
            class MockProcessor extends BaseProcessor {
                async process(dataProducts, context) {
                    return [...dataProducts, { id: 'processed' }];
                }
            }
            
            const mockProcessor = new MockProcessor();
            const result = await mockProcessor.handle([{ id: 'initial' }], { test: true });
            
            expect(result).toEqual([{ id: 'initial' }, { id: 'processed' }]);
        });

        it('should call process and pass result to next processor', async () => {
            class FirstProcessor extends BaseProcessor {
                async process(dataProducts, context) {
                    return [...dataProducts, { id: 'first' }];
                }
            }
            
            class SecondProcessor extends BaseProcessor {
                async process(dataProducts, context) {
                    return [...dataProducts, { id: 'second' }];
                }
            }
            
            const first = new FirstProcessor();
            const second = new SecondProcessor();
            first.setNext(second);
            
            const result = await first.handle([{ id: 'initial' }], { test: true });
            
            expect(result).toEqual([
                { id: 'initial' },
                { id: 'first' },
                { id: 'second' }
            ]);
        });

        it('should handle async processing correctly', async () => {
            class AsyncProcessor extends BaseProcessor {
                async process(dataProducts, context) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    return [...dataProducts, { id: 'async' }];
                }
            }
            
            const asyncProcessor = new AsyncProcessor();
            const result = await asyncProcessor.handle([], {});
            
            expect(result).toEqual([{ id: 'async' }]);
        });

        it('should propagate errors from process method', async () => {
            class ErrorProcessor extends BaseProcessor {
                async process(dataProducts, context) {
                    throw new Error('Processing failed');
                }
            }
            
            const errorProcessor = new ErrorProcessor();
            await expect(errorProcessor.handle([], {})).rejects.toThrow('Processing failed');
        });

        it('should propagate errors from next processor', async () => {
            class FirstProcessor extends BaseProcessor {
                async process(dataProducts, context) {
                    return dataProducts;
                }
            }
            
            class ErrorProcessor extends BaseProcessor {
                async process(dataProducts, context) {
                    throw new Error('Next processor failed');
                }
            }
            
            const first = new FirstProcessor();
            const error = new ErrorProcessor();
            first.setNext(error);
            
            await expect(first.handle([], {})).rejects.toThrow('Next processor failed');
        });

        it('should maintain context through the chain', async () => {
            const contexts = [];
            
            class ContextProcessor extends BaseProcessor {
                constructor(id) {
                    super();
                    this.id = id;
                }
                
                async process(dataProducts, context) {
                    contexts.push({ id: this.id, context });
                    return dataProducts;
                }
            }
            
            const proc1 = new ContextProcessor('p1');
            const proc2 = new ContextProcessor('p2');
            const proc3 = new ContextProcessor('p3');
            
            proc1.setNext(proc2).setNext(proc3);
            
            const context = { original: true };
            await proc1.handle([], context);
            
            expect(contexts).toHaveLength(3);
            expect(contexts[0].context).toBe(context);
            expect(contexts[1].context).toBe(context);
            expect(contexts[2].context).toBe(context);
        });
    });
});