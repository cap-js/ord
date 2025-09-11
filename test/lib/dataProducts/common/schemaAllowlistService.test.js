const { Logger } = require('../../../../lib/logger');

// Mock dependencies first
jest.mock('../../../../lib/dataProducts/common/schemaLoader');
jest.mock('../../../../lib/logger');
jest.mock('fs');

// We need to mock configProvider before requiring schemaAllowlistService
// because schemaAllowlistService imports configProvider at the top level
jest.mock('../../../../lib/dataProducts/config/configProvider', () => ({
    getTransformerAnnotationConfig: jest.fn(),
    getShareAnnotationConfig: jest.fn(),
    getCsnAnnotationConfig: jest.fn(),
    getDpdAnnotationConfig: jest.fn()
}));

const fs = require('fs');
const { loadSchemaWithFallback } = require('../../../../lib/dataProducts/common/schemaLoader');
const configProvider = require('../../../../lib/dataProducts/config/configProvider');

describe('schemaAllowlistService', () => {
    let schemaAllowlistService;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup default mocks
        fs.existsSync.mockReturnValue(false);
        
        // Reset all config provider mocks to return null by default
        configProvider.getTransformerAnnotationConfig.mockReturnValue(null);
        configProvider.getShareAnnotationConfig.mockReturnValue(null);
        configProvider.getCsnAnnotationConfig.mockReturnValue(null);
        configProvider.getDpdAnnotationConfig.mockReturnValue(null);
        
        // Clear the module cache and re-require
        jest.isolateModules(() => {
            schemaAllowlistService = require('../../../../lib/dataProducts/common/schemaAllowlistService');
        });
    });

    describe('deriveAllowedKeysFromSchema', () => {
        it('should return empty array for null schema', () => {
            expect(schemaAllowlistService.deriveAllowedKeysFromSchema(null)).toEqual([]);
        });

        it('should return empty array for non-object schema', () => {
            expect(schemaAllowlistService.deriveAllowedKeysFromSchema('not an object')).toEqual([]);
            expect(schemaAllowlistService.deriveAllowedKeysFromSchema(123)).toEqual([]);
        });

        it('should extract properties from top-level properties', () => {
            const schema = {
                properties: {
                    name: { type: 'string' },
                    version: { type: 'string' },
                    description: { type: 'string' }
                }
            };
            const result = schemaAllowlistService.deriveAllowedKeysFromSchema(schema);
            expect(result).toContain('name');
            expect(result).toContain('version');
            expect(result).toContain('description');
            expect(result).toHaveLength(3);
        });

        it('should extract properties from definitions', () => {
            const schema = {
                definitions: {
                    Step: {
                        properties: {
                            stepKey: { type: 'string' },
                            packageName: { type: 'string' }
                        }
                    },
                    Parameters: {
                        properties: {
                            param1: { type: 'string' },
                            param2: { type: 'number' }
                        }
                    }
                }
            };
            const result = schemaAllowlistService.deriveAllowedKeysFromSchema(schema);
            expect(result).toContain('stepKey');
            expect(result).toContain('packageName');
            expect(result).toContain('param1');
            expect(result).toContain('param2');
            expect(result).toHaveLength(4);
        });

        it('should combine properties from both top-level and definitions', () => {
            const schema = {
                properties: {
                    name: { type: 'string' },
                    version: { type: 'string' }
                },
                definitions: {
                    Config: {
                        properties: {
                            timeout: { type: 'number' },
                            retry: { type: 'boolean' }
                        }
                    }
                }
            };
            const result = schemaAllowlistService.deriveAllowedKeysFromSchema(schema);
            expect(result).toContain('name');
            expect(result).toContain('version');
            expect(result).toContain('timeout');
            expect(result).toContain('retry');
            expect(result).toHaveLength(4);
        });

        it('should handle duplicate keys by returning unique values', () => {
            const schema = {
                properties: {
                    name: { type: 'string' }
                },
                definitions: {
                    Config: {
                        properties: {
                            name: { type: 'string' } // Duplicate
                        }
                    }
                }
            };
            const result = schemaAllowlistService.deriveAllowedKeysFromSchema(schema);
            expect(result).toContain('name');
            expect(result).toHaveLength(1);
        });

        it('should handle missing properties gracefully', () => {
            const schema = {
                definitions: {
                    Empty: {},
                    NoProps: {
                        type: 'object'
                    }
                }
            };
            const result = schemaAllowlistService.deriveAllowedKeysFromSchema(schema);
            expect(result).toEqual([]);
        });
    });

    describe('mergeAllowlists', () => {
        it('should return ["*"] when allowlist contains "*"', () => {
            const result = schemaAllowlistService.mergeAllowlists(
                ['schema1', 'schema2'],
                ['*'],
                ['observed1', 'observed2', 'observed3'],
                ['prefix.']
            );
            expect(result).toEqual(['*']);
        });

        it('should merge schema keys and config allowlist', () => {
            const result = schemaAllowlistService.mergeAllowlists(
                ['schema1', 'schema2'],
                ['config1', 'config2'],
                ['observed1'],
                []
            );
            expect(result).toContain('schema1');
            expect(result).toContain('schema2');
            expect(result).toContain('config1');
            expect(result).toContain('config2');
            expect(result).toHaveLength(4);
        });

        it('should add keys matching prefixes', () => {
            const result = schemaAllowlistService.mergeAllowlists(
                [],
                [],
                ['spark.version', 'spark.memory', 'other.config', 'regular'],
                ['spark.']
            );
            expect(result).toContain('spark.version');
            expect(result).toContain('spark.memory');
            expect(result).not.toContain('other.config');
            expect(result).not.toContain('regular');
            expect(result).toHaveLength(2);
        });

        it('should handle empty inputs', () => {
            const result = schemaAllowlistService.mergeAllowlists([], [], [], []);
            expect(result).toEqual([]);
        });

        it('should handle undefined inputs with defaults', () => {
            const result = schemaAllowlistService.mergeAllowlists();
            expect(result).toEqual([]);
        });

        it('should combine all sources without duplicates', () => {
            const result = schemaAllowlistService.mergeAllowlists(
                ['common', 'schema1'],
                ['common', 'config1'],
                ['prefix.test', 'observed1', 'common'],
                ['prefix.']
            );
            expect(result).toContain('common');
            expect(result).toContain('schema1');
            expect(result).toContain('config1');
            expect(result).toContain('prefix.test');
            expect(result.filter(k => k === 'common')).toHaveLength(1);
        });

        it('should handle multiple prefixes', () => {
            const result = schemaAllowlistService.mergeAllowlists(
                [],
                [],
                ['spark.version', 'flink.version', 'hadoop.config', 'other'],
                ['spark.', 'flink.']
            );
            expect(result).toContain('spark.version');
            expect(result).toContain('flink.version');
            expect(result).not.toContain('hadoop.config');
            expect(result).not.toContain('other');
        });
    });

    describe('getEffectiveAllowlist', () => {
        beforeEach(() => {
            // Clear mocks and re-require service for each test
            jest.clearAllMocks();
            jest.isolateModules(() => {
                schemaAllowlistService = require('../../../../lib/dataProducts/common/schemaAllowlistService');
            });
        });

        it('should return observed keys when no config found', async () => {
            configProvider.getTransformerAnnotationConfig.mockReturnValue(null);
            
            const result = await schemaAllowlistService.getEffectiveAllowlist('transformer', ['key1', 'key2']);
            expect(result).toEqual(['key1', 'key2']);
            expect(Logger.warn).toHaveBeenCalledWith('No configuration found for artifact: transformer');
        });

        it('should handle dynamic mode with schema', async () => {
            const mockSchema = {
                properties: {
                    name: { type: 'string' },
                    version: { type: 'string' }
                }
            };
            
            configProvider.getTransformerAnnotationConfig.mockReturnValue({
                allowlistMode: 'dynamic',
                allowlist: ['extra'],
                allowedPrefixes: ['spark.'],
                schemaUrl: 'http://example.com/schema.json',
                schemaLocalFile: 'transformer.json'
            });
            
            loadSchemaWithFallback.mockResolvedValue({
                schema: mockSchema,
                source: 'remote'
            });
            
            const result = await schemaAllowlistService.getEffectiveAllowlist('transformer', ['spark.version', 'other']);
            expect(result).toContain('name');
            expect(result).toContain('version');
            expect(result).toContain('extra');
            expect(result).toContain('spark.version');
            expect(result).not.toContain('other');
        });

        it('should handle dynamic mode when schema loading fails', async () => {
            configProvider.getTransformerAnnotationConfig.mockReturnValue({
                allowlistMode: 'dynamic',
                allowlist: ['fallback'],
                allowedPrefixes: [],
                schemaUrl: 'http://example.com/schema.json',
                schemaLocalFile: 'transformer.json'
            });
            
            loadSchemaWithFallback.mockRejectedValue(new Error('Failed to load'));
            
            const result = await schemaAllowlistService.getEffectiveAllowlist('transformer', ['observed']);
            expect(result).toContain('fallback');
            expect(result).not.toContain('observed');
            expect(Logger.warn).toHaveBeenCalledWith('Failed to load schema for transformer: Failed to load');
        });

        it('should handle static mode with allowlist', async () => {
            configProvider.getShareAnnotationConfig.mockReturnValue({
                allowlistMode: 'static',
                allowlist: ['allowed1', 'allowed2'],
                allowedPrefixes: []
            });
            
            const result = await schemaAllowlistService.getEffectiveAllowlist('share', ['observed1', 'allowed1']);
            expect(result).toContain('allowed1');
            expect(result).toContain('allowed2');
            expect(result).not.toContain('observed1');
        });

        it('should handle static mode with empty config (allow all)', async () => {
            configProvider.getCsnAnnotationConfig.mockReturnValue({
                allowlistMode: 'static',
                allowlist: [],
                allowedPrefixes: []
            });
            
            const result = await schemaAllowlistService.getEffectiveAllowlist('csn', ['any', 'key']);
            expect(result).toEqual(['any', 'key']);
        });

        it('should handle wildcard in allowlist', async () => {
            configProvider.getDpdAnnotationConfig.mockReturnValue({
                allowlistMode: 'dynamic',
                allowlist: ['*'],
                allowedPrefixes: []
            });
            
            const result = await schemaAllowlistService.getEffectiveAllowlist('dataproduct', ['any', 'key', 'works']);
            expect(result).toEqual(['*']);
        });

        it('should cache results for same inputs', async () => {
            configProvider.getTransformerAnnotationConfig.mockReturnValue({
                allowlistMode: 'static',
                allowlist: ['cached'],
                allowedPrefixes: []
            });
            
            const result1 = await schemaAllowlistService.getEffectiveAllowlist('transformer', ['key1', 'key2']);
            const result2 = await schemaAllowlistService.getEffectiveAllowlist('transformer', ['key1', 'key2']);
            
            expect(result1).toEqual(result2);
            expect(configProvider.getTransformerAnnotationConfig).toHaveBeenCalledTimes(1);
        });

        it('should not use cache for different inputs', async () => {
            configProvider.getTransformerAnnotationConfig.mockReturnValue({
                allowlistMode: 'static',
                allowlist: ['test'],
                allowedPrefixes: []
            });
            
            await schemaAllowlistService.getEffectiveAllowlist('transformer', ['key1']);
            await schemaAllowlistService.getEffectiveAllowlist('transformer', ['key2']);
            
            expect(configProvider.getTransformerAnnotationConfig).toHaveBeenCalledTimes(2);
        });

        it('should default to static mode when mode not specified', async () => {
            configProvider.getTransformerAnnotationConfig.mockReturnValue({
                allowlist: ['static'],
                allowedPrefixes: []
            });
            
            const result = await schemaAllowlistService.getEffectiveAllowlist('transformer', ['observed']);
            expect(result).toContain('static');
            expect(result).not.toContain('observed');
        });
    });

    describe('initializeSchemas', () => {
        beforeEach(() => {
            // Clear mocks and re-require service for each test
            jest.clearAllMocks();
            jest.isolateModules(() => {
                schemaAllowlistService = require('../../../../lib/dataProducts/common/schemaAllowlistService');
            });
        });

        it('should load schemas for all dynamic mode artifacts', async () => {
            configProvider.getTransformerAnnotationConfig.mockReturnValue({
                allowlistMode: 'dynamic',
                schemaUrl: 'http://example.com/transformer.json',
                schemaLocalFile: 'transformer.json'
            });
            
            configProvider.getShareAnnotationConfig.mockReturnValue({
                allowlistMode: 'dynamic',
                schemaUrl: 'http://example.com/share.json',
                schemaLocalFile: 'share.json'
            });
            
            configProvider.getCsnAnnotationConfig.mockReturnValue({
                allowlistMode: 'static', // Not dynamic
                schemaUrl: 'http://example.com/csn.json',
                schemaLocalFile: 'csn.json'
            });
            
            configProvider.getDpdAnnotationConfig.mockReturnValue({
                allowlistMode: 'dynamic',
                schemaUrl: 'http://example.com/dpd.json',
                schemaLocalFile: 'dpd.json'
            });
            
            loadSchemaWithFallback.mockResolvedValue({
                schema: { properties: {} },
                source: 'local'
            });
            
            await schemaAllowlistService.initializeSchemas();
            
            expect(loadSchemaWithFallback).toHaveBeenCalledTimes(3); // Only dynamic modes
            expect(loadSchemaWithFallback).toHaveBeenCalledWith(
                'transformer-allow',
                'http://example.com/transformer.json',
                expect.stringContaining('transformer.json')
            );
            expect(loadSchemaWithFallback).toHaveBeenCalledWith(
                'share-allow',
                'http://example.com/share.json',
                expect.stringContaining('share.json')
            );
            expect(loadSchemaWithFallback).toHaveBeenCalledWith(
                'dataproduct-allow',
                'http://example.com/dpd.json',
                expect.stringContaining('dpd.json')
            );
            expect(Logger.info).toHaveBeenCalledWith('Schema allowlist service initialized');
        });

        it('should handle schema loading failures gracefully', async () => {
            configProvider.getTransformerAnnotationConfig.mockReturnValue({
                allowlistMode: 'dynamic',
                schemaUrl: 'http://example.com/transformer.json',
                schemaLocalFile: 'transformer.json'
            });
            
            configProvider.getShareAnnotationConfig.mockReturnValue(null);
            configProvider.getCsnAnnotationConfig.mockReturnValue(null);
            configProvider.getDpdAnnotationConfig.mockReturnValue(null);
            
            loadSchemaWithFallback.mockRejectedValue(new Error('Network error'));
            
            await schemaAllowlistService.initializeSchemas();
            
            expect(Logger.warn).toHaveBeenCalledWith('Failed to load schema for transformer: Network error');
            expect(Logger.info).toHaveBeenCalledWith('Schema allowlist service initialized');
        });

        it('should skip artifacts with no config', async () => {
            configProvider.getTransformerAnnotationConfig.mockReturnValue(null);
            configProvider.getShareAnnotationConfig.mockReturnValue(null);
            configProvider.getCsnAnnotationConfig.mockReturnValue(null);
            configProvider.getDpdAnnotationConfig.mockReturnValue(null);
            
            await schemaAllowlistService.initializeSchemas();
            
            expect(loadSchemaWithFallback).not.toHaveBeenCalled();
            expect(Logger.info).toHaveBeenCalledWith('Schema allowlist service initialized');
        });
    });
});