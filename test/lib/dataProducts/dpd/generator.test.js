const { generateDataProductFiles } = require('../../../../lib/dataProducts/dpd/generator');
const { initializeSchemas } = require('../../../../lib/dataProducts/common/schemaAllowlistService');
const { createDataProductProcessor } = require('../../../../lib/dataProducts/processors/processor');
const { buildDpdObject } = require('../../../../lib/dataProducts/dpd/dpdFactory');
const { buildTransformerObject } = require('../../../../lib/dataProducts/transformer/transformerFactory');
const { buildShareObject } = require('../../../../lib/dataProducts/share/shareFactory');
const { buildCsnObject } = require('../../../../lib/dataProducts/csn/csnFactory');
const { Logger } = require('../../../../lib/logger');

jest.mock('../../../../lib/dataProducts/common/schemaAllowlistService');
jest.mock('../../../../lib/dataProducts/processors/processor');
jest.mock('../../../../lib/dataProducts/dpd/dpdFactory');
jest.mock('../../../../lib/dataProducts/transformer/transformerFactory');
jest.mock('../../../../lib/dataProducts/share/shareFactory');
jest.mock('../../../../lib/dataProducts/csn/csnFactory');
jest.mock('../../../../lib/logger');

describe('generator', () => {
    let mockProcessor;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockProcessor = {
            process: jest.fn()
        };
        
        createDataProductProcessor.mockReturnValue(mockProcessor);
        initializeSchemas.mockResolvedValue();
        buildDpdObject.mockResolvedValue({ dpd: 'object' });
        buildTransformerObject.mockReturnValue({ transformer: 'object' });
        buildShareObject.mockReturnValue({ share: 'object' });
        buildCsnObject.mockReturnValue({ csn: 'object' });
    });

    describe('generateDataProductFiles', () => {
        it('should initialize schemas before processing', async () => {
            mockProcessor.process.mockResolvedValue([]);
            
            await generateDataProductFiles({
                definitions: {}
            }, {});
            
            expect(initializeSchemas).toHaveBeenCalled();
            expect(createDataProductProcessor).toHaveBeenCalled();
            // Check order by checking call order
            const initializeCall = initializeSchemas.mock.invocationCallOrder[0];
            const createProcessorCall = createDataProductProcessor.mock.invocationCallOrder[0];
            expect(initializeCall).toBeLessThan(createProcessorCall);
        });

        it('should create processor and context correctly', async () => {
            const csn = {
                definitions: {
                    TestService: { kind: 'service' }
                }
            };
            const appConfig = { ordNamespace: 'test' };
            
            mockProcessor.process.mockResolvedValue([]);
            
            await generateDataProductFiles(csn, appConfig);
            
            expect(createDataProductProcessor).toHaveBeenCalled();
            expect(mockProcessor.process).toHaveBeenCalledWith({
                csn,
                appConfig,
                annotationReader: expect.any(Object),
                transformerAnnotationReader: expect.any(Object),
                shareAnnotationReader: expect.any(Object),
                csnAnnotationReader: expect.any(Object)
            });
        });

        it('should generate files for each data product', async () => {
            const dataProducts = [
                {
                    serviceName: 'Service1',
                    name: 'Product1',
                    namespace: 'com.example',
                    version: '1.0.0'
                }
            ];
            
            mockProcessor.process.mockResolvedValue(dataProducts);
            
            const result = await generateDataProductFiles({
                definitions: {}
            }, {});
            
            expect(result).toHaveLength(4); // dpd, transformer, share, csn
            expect(result[0].path).toBe('com/example/dataproducts/Product1_1.0.0.json');
            expect(result[1].path).toBe('com/example/transformer/Product1_1.0.0.json');
            expect(result[2].path).toBe('com/example/share/Product1_1.0.0.json');
            expect(result[3].path).toBe('com/example/csn_documents/Product1_1.0.0.json');
        });

        it('should use defaults when values are missing', async () => {
            const dataProducts = [
                {
                    serviceName: 'Service1'
                }
            ];
            
            mockProcessor.process.mockResolvedValue(dataProducts);
            
            const result = await generateDataProductFiles({
                definitions: {}
            }, { ordNamespace: 'default.namespace' });
            
            expect(result[0].path).toBe('default/namespace/dataproducts/Service1_1.0.0.json');
        });

        it('should handle multiple data products', async () => {
            const dataProducts = [
                { serviceName: 'Service1', name: 'Product1' },
                { serviceName: 'Service2', name: 'Product2' }
            ];
            
            mockProcessor.process.mockResolvedValue(dataProducts);
            
            const result = await generateDataProductFiles({
                definitions: {}
            }, {});
            
            expect(result).toHaveLength(8); // 4 files per product
            expect(Logger.info).toHaveBeenCalledWith('Generated all files for data product: Product1');
            expect(Logger.info).toHaveBeenCalledWith('Generated all files for data product: Product2');
        });

        it('should handle async factory methods correctly', async () => {
            const dataProducts = [
                { serviceName: 'Service1' }
            ];
            
            mockProcessor.process.mockResolvedValue(dataProducts);
            buildDpdObject.mockResolvedValue({ async: 'dpd' });
            
            const result = await generateDataProductFiles({
                definitions: {}
            }, {});
            
            expect(buildDpdObject).toHaveBeenCalled();
            expect(JSON.parse(result[0].content)).toEqual({ async: 'dpd' });
        });

        it('should format JSON with proper indentation', async () => {
            const dataProducts = [
                { serviceName: 'Service1' }
            ];
            
            mockProcessor.process.mockResolvedValue(dataProducts);
            buildDpdObject.mockResolvedValue({ key: 'value' });
            
            const result = await generateDataProductFiles({
                definitions: {}
            }, {});
            
            expect(result[0].content).toBe(JSON.stringify({ key: 'value' }, null, 2));
        });

        it('should pass correct config to factories', async () => {
            const csn = { definitions: {} };
            const appConfig = { ordNamespace: 'test' };
            const dataProducts = [
                {
                    serviceName: 'Service1',
                    namespace: 'com.example',
                    version: '2.0.0',
                    name: 'Product1'
                }
            ];
            
            mockProcessor.process.mockResolvedValue(dataProducts);
            
            await generateDataProductFiles(csn, appConfig);
            
            const expectedConfig = {
                serviceName: 'Service1',
                namespace: 'com.example',
                version: '2.0.0',
                name: 'Product1'
            };
            
            expect(buildDpdObject).toHaveBeenCalledWith(expectedConfig, csn, appConfig);
            expect(buildTransformerObject).toHaveBeenCalledWith(expectedConfig, csn, appConfig);
            expect(buildShareObject).toHaveBeenCalledWith(expectedConfig, csn, appConfig);
            expect(buildCsnObject).toHaveBeenCalledWith(expectedConfig, csn, appConfig);
        });
    });
});