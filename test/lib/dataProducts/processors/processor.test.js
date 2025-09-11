const { DataProductProcessorChain, createDataProductProcessor } = require('../../../../lib/dataProducts/processors/processor');
const { Logger } = require('../../../../lib/logger');

// Mock all processor implementations
jest.mock('../../../../lib/dataProducts/dpd/processors/defaultsProcessor');
jest.mock('../../../../lib/dataProducts/dpd/processors/coreAnnotationsProcessor');
jest.mock('../../../../lib/dataProducts/dpd/processors/dpdAllowlistGuardProcessor');
jest.mock('../../../../lib/dataProducts/dpd/processors/taxonomyAnnotationsProcessor');
jest.mock('../../../../lib/dataProducts/dpd/processors/lifecycleAnnotationsProcessor');
jest.mock('../../../../lib/dataProducts/dpd/processors/entityTypesProcessor');
jest.mock('../../../../lib/dataProducts/transformer/processors/transformerAnnotationsProcessor');
jest.mock('../../../../lib/dataProducts/share/processors/shareAnnotationsProcessor');
jest.mock('../../../../lib/dataProducts/csn/processors/csnAnnotationsProcessor');
jest.mock('../../../../lib/logger');

const DefaultsProcessor = require('../../../../lib/dataProducts/dpd/processors/defaultsProcessor');
const CoreAnnotationsProcessor = require('../../../../lib/dataProducts/dpd/processors/coreAnnotationsProcessor');
const DpdAllowlistGuardProcessor = require('../../../../lib/dataProducts/dpd/processors/dpdAllowlistGuardProcessor');
const TaxonomyAnnotationsProcessor = require('../../../../lib/dataProducts/dpd/processors/taxonomyAnnotationsProcessor');
const LifecycleAnnotationsProcessor = require('../../../../lib/dataProducts/dpd/processors/lifecycleAnnotationsProcessor');
const EntityTypesProcessor = require('../../../../lib/dataProducts/dpd/processors/entityTypesProcessor');
const { TransformerAnnotationsProcessor } = require('../../../../lib/dataProducts/transformer/processors/transformerAnnotationsProcessor');
const { ShareAnnotationsProcessor } = require('../../../../lib/dataProducts/share/processors/shareAnnotationsProcessor');
const { CsnAnnotationsProcessor } = require('../../../../lib/dataProducts/csn/processors/csnAnnotationsProcessor');

describe('DataProductProcessorChain', () => {
    let chain;
    let mockHandleMethod;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Create a mock handle method that can be shared
        mockHandleMethod = jest.fn().mockResolvedValue([{ id: 'processed' }]);
        
        // Mock all processor constructors to return instances with setNext method
        const createMockProcessor = (name) => {
            const processor = {
                name,
                next: null,
                setNext: jest.fn(function(nextProcessor) {
                    this.next = nextProcessor;
                    return nextProcessor;
                }),
                handle: mockHandleMethod
            };
            return processor;
        };
        
        DefaultsProcessor.mockImplementation(() => createMockProcessor('defaults'));
        CoreAnnotationsProcessor.mockImplementation(() => createMockProcessor('core'));
        DpdAllowlistGuardProcessor.mockImplementation(() => createMockProcessor('allowlist'));
        TaxonomyAnnotationsProcessor.mockImplementation(() => createMockProcessor('taxonomy'));
        LifecycleAnnotationsProcessor.mockImplementation(() => createMockProcessor('lifecycle'));
        EntityTypesProcessor.mockImplementation(() => createMockProcessor('entityTypes'));
        TransformerAnnotationsProcessor.mockImplementation(() => createMockProcessor('transformer'));
        ShareAnnotationsProcessor.mockImplementation(() => createMockProcessor('share'));
        CsnAnnotationsProcessor.mockImplementation(() => createMockProcessor('csn'));
        
        chain = new DataProductProcessorChain();
    });

    describe('constructor', () => {
        it('should build the processor chain on initialization', () => {
            expect(DefaultsProcessor).toHaveBeenCalledTimes(1);
            expect(CoreAnnotationsProcessor).toHaveBeenCalledTimes(1);
            expect(DpdAllowlistGuardProcessor).toHaveBeenCalledTimes(1);
            expect(TaxonomyAnnotationsProcessor).toHaveBeenCalledTimes(1);
            expect(LifecycleAnnotationsProcessor).toHaveBeenCalledTimes(1);
            expect(EntityTypesProcessor).toHaveBeenCalledTimes(1);
            expect(TransformerAnnotationsProcessor).toHaveBeenCalledTimes(1);
            expect(ShareAnnotationsProcessor).toHaveBeenCalledTimes(1);
            expect(CsnAnnotationsProcessor).toHaveBeenCalledTimes(1);
        });

        it('should set chain property to the first processor', () => {
            expect(chain.chain).toBeDefined();
            expect(chain.chain.name).toBe('defaults');
        });
    });

    describe('buildChain', () => {
        it('should create processors in correct order', () => {
            const defaultsInstance = DefaultsProcessor.mock.results[0].value;
            const coreInstance = CoreAnnotationsProcessor.mock.results[0].value;
            const allowlistInstance = DpdAllowlistGuardProcessor.mock.results[0].value;
            const taxonomyInstance = TaxonomyAnnotationsProcessor.mock.results[0].value;
            const lifecycleInstance = LifecycleAnnotationsProcessor.mock.results[0].value;
            const entityTypesInstance = EntityTypesProcessor.mock.results[0].value;
            const transformerInstance = TransformerAnnotationsProcessor.mock.results[0].value;
            const shareInstance = ShareAnnotationsProcessor.mock.results[0].value;
            const csnInstance = CsnAnnotationsProcessor.mock.results[0].value;
            
            // Verify the chain setup calls
            expect(defaultsInstance.setNext).toHaveBeenCalledWith(allowlistInstance);
            expect(allowlistInstance.setNext).toHaveBeenCalledWith(coreInstance);
            expect(coreInstance.setNext).toHaveBeenCalledWith(taxonomyInstance);
            expect(taxonomyInstance.setNext).toHaveBeenCalledWith(lifecycleInstance);
            expect(lifecycleInstance.setNext).toHaveBeenCalledWith(entityTypesInstance);
            expect(entityTypesInstance.setNext).toHaveBeenCalledWith(transformerInstance);
            expect(transformerInstance.setNext).toHaveBeenCalledWith(shareInstance);
            expect(shareInstance.setNext).toHaveBeenCalledWith(csnInstance);
        });
    });

    describe('process', () => {
        it('should validate context has required properties', async () => {
            await expect(chain.process(null)).rejects.toThrow('Invalid CSN: missing definitions');
            await expect(chain.process({})).rejects.toThrow('Invalid CSN: missing definitions');
            await expect(chain.process({ csn: {} })).rejects.toThrow('Invalid CSN: missing definitions');
            await expect(chain.process({ csn: null })).rejects.toThrow('Invalid CSN: missing definitions');
        });

        it('should process valid context successfully', async () => {
            const context = {
                csn: {
                    definitions: {
                        TestService: { kind: 'service' }
                    }
                },
                appConfig: { ordNamespace: 'test' }
            };
            
            const result = await chain.process(context);
            
            expect(Logger.info).toHaveBeenCalledWith('Starting data product processing chain');
            expect(mockHandleMethod).toHaveBeenCalledWith([], context);
            expect(result).toEqual([{ id: 'processed' }]);
            expect(Logger.info).toHaveBeenCalledWith('Completed processing 1 data products');
        });

        it('should handle empty definitions', async () => {
            const context = {
                csn: {
                    definitions: {}
                }
            };
            
            mockHandleMethod.mockResolvedValue([]);
            const result = await chain.process(context);
            
            expect(result).toEqual([]);
            expect(Logger.info).toHaveBeenCalledWith('Completed processing 0 data products');
        });

        it('should handle multiple data products', async () => {
            const context = {
                csn: {
                    definitions: {
                        Service1: { kind: 'service' },
                        Service2: { kind: 'service' }
                    }
                }
            };
            
            const dataProducts = [
                { id: 'dp1', serviceName: 'Service1' },
                { id: 'dp2', serviceName: 'Service2' }
            ];
            mockHandleMethod.mockResolvedValue(dataProducts);
            
            const result = await chain.process(context);
            
            expect(result).toEqual(dataProducts);
            expect(Logger.info).toHaveBeenCalledWith('Completed processing 2 data products');
        });

        it('should propagate errors from processor chain', async () => {
            const context = {
                csn: {
                    definitions: { TestService: {} }
                }
            };
            
            const error = new Error('Processing failed');
            mockHandleMethod.mockRejectedValue(error);
            
            await expect(chain.process(context)).rejects.toThrow('Processing failed');
        });

        it('should pass empty array as initial data products', async () => {
            const context = {
                csn: {
                    definitions: { TestService: {} }
                }
            };
            
            await chain.process(context);
            
            expect(mockHandleMethod).toHaveBeenCalledWith([], context);
        });
    });
});

describe('createDataProductProcessor', () => {
    it('should create and return a new DataProductProcessorChain instance', () => {
        const processor = createDataProductProcessor();
        
        expect(processor).toBeInstanceOf(DataProductProcessorChain);
        expect(processor.chain).toBeDefined();
    });

    it('should create independent instances', () => {
        const processor1 = createDataProductProcessor();
        const processor2 = createDataProductProcessor();
        
        expect(processor1).not.toBe(processor2);
        expect(processor1.chain).not.toBe(processor2.chain);
    });
});