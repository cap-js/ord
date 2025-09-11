const EntityTypesProcessor = require('../../../../../lib/dataProducts/dpd/processors/entityTypesProcessor');
const { Logger } = require('../../../../../lib/logger');

jest.mock('../../../../../lib/logger');

describe('EntityTypesProcessor', () => {
    let processor;

    beforeEach(() => {
        jest.clearAllMocks();
        processor = new EntityTypesProcessor();
    });

    describe('process', () => {
        it('should extract entity types from service definitions', async () => {
            const dataProducts = [
                { serviceName: 'Service1' }
            ];
            
            const context = {
                csn: {
                    definitions: {
                        Service1: {
                            kind: 'service',
                            elements: {
                                Entity1: { kind: 'entity' },
                                Entity2: { kind: 'entity' },
                                NotAnEntity: { kind: 'type' }
                            }
                        }
                    }
                },
                annotationReader: {
                    get: jest.fn().mockReturnValue(null)
                },
                appConfig: { ordNamespace: 'com.example' }
            };

            const result = await processor.process(dataProducts, context);

            expect(result[0].entityTypes).toEqual([
                'com.example:entityType:Entity1:v1',
                'com.example:entityType:Entity2:v1'
            ]);
            expect(Logger.info).toHaveBeenCalledWith('EntityTypesProcessor: Extracting entity types from data products');
            expect(Logger.info).toHaveBeenCalledWith('Added 2 entity types to Service1');
        });

        it('should use default namespace when not provided', async () => {
            const dataProducts = [
                { serviceName: 'Service1' }
            ];
            
            const context = {
                csn: {
                    definitions: {
                        Service1: {
                            kind: 'service',
                            elements: {
                                Entity1: { kind: 'entity' }
                            }
                        }
                    }
                },
                annotationReader: {
                    get: jest.fn().mockReturnValue(null)
                },
                appConfig: {}
            };

            const result = await processor.process(dataProducts, context);

            expect(result[0].entityTypes).toEqual([
                'customer.default:entityType:Entity1:v1'
            ]);
        });

        it('should handle services without elements', async () => {
            const dataProducts = [
                { serviceName: 'Service1' }
            ];
            
            const context = {
                csn: {
                    definitions: {
                        Service1: {
                            kind: 'service'
                        }
                    }
                },
                annotationReader: {
                    get: jest.fn().mockReturnValue(null)
                },
                appConfig: {}
            };

            const result = await processor.process(dataProducts, context);

            expect(result[0].entityTypes).toBeUndefined();
        });

        it('should skip non-existent services', async () => {
            const dataProducts = [
                { serviceName: 'NonExistent' }
            ];
            
            const context = {
                csn: {
                    definitions: {}
                },
                annotationReader: {
                    get: jest.fn().mockReturnValue(null)
                },
                appConfig: {}
            };

            const result = await processor.process(dataProducts, context);

            expect(result[0]).toEqual({ serviceName: 'NonExistent' });
            expect(Logger.warn).toHaveBeenCalledWith('Service NonExistent not found in CSN definitions');
        });

        it('should preserve existing properties', async () => {
            const dataProducts = [
                { 
                    serviceName: 'Service1',
                    existingProp: 'value'
                }
            ];
            
            const context = {
                csn: {
                    definitions: {
                        Service1: {
                            kind: 'service',
                            elements: {
                                Entity1: { kind: 'entity' }
                            }
                        }
                    }
                },
                annotationReader: {
                    get: jest.fn().mockReturnValue(null)
                },
                appConfig: {}
            };

            const result = await processor.process(dataProducts, context);

            expect(result[0].existingProp).toBe('value');
            expect(result[0].entityTypes).toBeDefined();
        });

        it('should handle multiple data products', async () => {
            const dataProducts = [
                { serviceName: 'Service1' },
                { serviceName: 'Service2' }
            ];
            
            const context = {
                csn: {
                    definitions: {
                        Service1: {
                            kind: 'service',
                            elements: {
                                Entity1: { kind: 'entity' }
                            }
                        },
                        Service2: {
                            kind: 'service',
                            elements: {
                                Entity2: { kind: 'entity' },
                                Entity3: { kind: 'entity' }
                            }
                        }
                    }
                },
                annotationReader: {
                    get: jest.fn().mockReturnValue(null)
                },
                appConfig: { ordNamespace: 'test' }
            };

            const result = await processor.process(dataProducts, context);

            expect(result[0].entityTypes).toHaveLength(1);
            expect(result[1].entityTypes).toHaveLength(2);
        });
    });
});