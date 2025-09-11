const CoreAnnotationsProcessor = require('../../../../../lib/dataProducts/dpd/processors/coreAnnotationsProcessor');
const { Logger } = require('../../../../../lib/logger');

jest.mock('../../../../../lib/logger');

describe('CoreAnnotationsProcessor', () => {
    let processor;
    let mockAnnotationReader;

    beforeEach(() => {
        jest.clearAllMocks();
        processor = new CoreAnnotationsProcessor();
        mockAnnotationReader = {
            get: jest.fn()
        };
    });

    describe('process', () => {
        it('should apply core annotations to data products', async () => {
            const dataProducts = [
                { serviceName: 'Service1' },
                { serviceName: 'Service2' }
            ];
            
            const context = {
                annotationReader: mockAnnotationReader
            };

            mockAnnotationReader.get.mockImplementation((service, key) => {
                if (service === 'Service1' && key === 'name') return 'CustomName';
                if (service === 'Service1' && key === 'version') return '2.0.0';
                if (service === 'Service2' && key === 'description') return 'Test description';
                return null;
            });

            const result = await processor.process(dataProducts, context);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                serviceName: 'Service1',
                name: 'CustomName',
                version: '2.0.0'
            });
            expect(result[1]).toEqual({
                serviceName: 'Service2',
                description: 'Test description'
            });
            expect(Logger.info).toHaveBeenCalledWith('CoreAnnotationsProcessor: Applying core annotations to data products');
            expect(Logger.info).toHaveBeenCalledWith('Applied core annotations to Service1');
            expect(Logger.info).toHaveBeenCalledWith('Applied core annotations to Service2');
        });

        it('should skip null values', async () => {
            const dataProducts = [
                { serviceName: 'Service1' }
            ];
            
            const context = {
                annotationReader: mockAnnotationReader
            };

            mockAnnotationReader.get.mockReturnValue(null);

            const result = await processor.process(dataProducts, context);

            expect(result[0]).toEqual({ serviceName: 'Service1' });
        });

        it('should check all standard core annotations', async () => {
            const dataProducts = [
                { serviceName: 'Service1' }
            ];
            
            const context = {
                annotationReader: mockAnnotationReader
            };

            mockAnnotationReader.get.mockReturnValue(null);

            await processor.process(dataProducts, context);

            const expectedAnnotations = [
                'name', 'version', 'visibility', 'releaseStatus',
                'title', 'shortDescription', 'description', 'namespace'
            ];

            expectedAnnotations.forEach(annotation => {
                expect(mockAnnotationReader.get).toHaveBeenCalledWith('Service1', annotation);
            });
        });

        it('should handle empty data products array', async () => {
            const context = {
                annotationReader: mockAnnotationReader
            };

            const result = await processor.process([], context);

            expect(result).toEqual([]);
            expect(mockAnnotationReader.get).not.toHaveBeenCalled();
        });

        it('should preserve existing properties', async () => {
            const dataProducts = [
                { 
                    serviceName: 'Service1',
                    existingProp: 'value'
                }
            ];
            
            const context = {
                annotationReader: mockAnnotationReader
            };

            mockAnnotationReader.get.mockImplementation((service, key) => {
                if (key === 'name') return 'NewName';
                return null;
            });

            const result = await processor.process(dataProducts, context);

            expect(result[0]).toEqual({
                serviceName: 'Service1',
                existingProp: 'value',
                name: 'NewName'
            });
        });
    });
});