const DefaultsProcessor = require('../../../../../lib/dataProducts/dpd/processors/defaultsProcessor');
const { Logger } = require('../../../../../lib/logger');

jest.mock('../../../../../lib/logger');

describe('DefaultsProcessor', () => {
    let processor;
    let mockAnnotationReader;

    beforeEach(() => {
        jest.clearAllMocks();
        processor = new DefaultsProcessor();
        mockAnnotationReader = {
            hasAnyAnnotation: jest.fn(),
            get: jest.fn()
        };
    });

    describe('process', () => {
        it('should create default data products for annotated services', async () => {
            const context = {
                annotationReader: mockAnnotationReader,
                csn: {
                    definitions: {
                        Service1: { kind: 'service' },
                        Service2: { kind: 'service' },
                        Entity1: { kind: 'entity' }
                    }
                }
            };

            mockAnnotationReader.hasAnyAnnotation.mockImplementation((service) => {
                return service === 'Service1';
            });

            const result = await processor.process([], context);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                serviceName: 'Service1',
                name: 'Service1',
                version: '1.0.0'
            });
            expect(Logger.info).toHaveBeenCalledWith('DefaultsProcessor: Creating default data products for services with annotations');
            expect(Logger.info).toHaveBeenCalledWith('Created default data product for service: Service1');
        });

        it('should skip services without annotations', async () => {
            const context = {
                annotationReader: mockAnnotationReader,
                csn: {
                    definitions: {
                        Service1: { kind: 'service' },
                        Service2: { kind: 'service' }
                    }
                }
            };

            mockAnnotationReader.hasAnyAnnotation.mockReturnValue(false);

            const result = await processor.process([], context);

            expect(result).toHaveLength(0);
        });

        it('should only process service definitions', async () => {
            const context = {
                annotationReader: mockAnnotationReader,
                csn: {
                    definitions: {
                        Service1: { kind: 'service' },
                        Entity1: { kind: 'entity' },
                        Type1: { kind: 'type' }
                    }
                }
            };

            mockAnnotationReader.hasAnyAnnotation.mockReturnValue(true);

            const result = await processor.process([], context);

            expect(result).toHaveLength(1);
            expect(result[0].serviceName).toBe('Service1');
            expect(mockAnnotationReader.hasAnyAnnotation).toHaveBeenCalledTimes(1);
            expect(mockAnnotationReader.hasAnyAnnotation).toHaveBeenCalledWith('Service1');
        });

        it('should handle empty definitions', async () => {
            const context = {
                annotationReader: mockAnnotationReader,
                csn: {
                    definitions: {}
                }
            };

            const result = await processor.process([], context);

            expect(result).toHaveLength(0);
            expect(mockAnnotationReader.hasAnyAnnotation).not.toHaveBeenCalled();
        });

        it('should preserve existing data products', async () => {
            const existingProducts = [{ id: 'existing' }];
            const context = {
                annotationReader: mockAnnotationReader,
                csn: {
                    definitions: {
                        Service1: { kind: 'service' }
                    }
                }
            };

            mockAnnotationReader.hasAnyAnnotation.mockReturnValue(true);

            const result = await processor.process(existingProducts, context);

            expect(result).toContain({ id: 'existing' });
            expect(result).toHaveLength(2);
        });
    });
});