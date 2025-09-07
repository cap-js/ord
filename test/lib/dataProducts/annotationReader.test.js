const { AnnotationReader } = require('../../../lib/dataProducts/annotationReader');

describe('AnnotationReader', () => {
    let definitions;

    beforeEach(() => {
        // Reset definitions for each test
        definitions = {
            TestService: {
                kind: 'service',
                '@name': 'TestService',
                '@version': '1.0.0',
                '@title': 'Test Service',
                '@DataIntegration.dataProduct': true,
                '@DataIntegration.dataProduct.type': 'primary',
                '@transformer.name': 'TestTransformer',
                '@transformer.dpdType': 'analytical',
                '@share.isRuntimeExtensible': true,
                '@share.includeEntities': ['Entity1', 'Entity2'],
                '@csn.includeVirtual': true
            },
            AnotherService: {
                kind: 'service',
                '@name': 'AnotherService',
                '@ORD.dataProduct': true,
                '@ORD.dataProduct.version': '2.0.0'
            },
            NotAService: {
                kind: 'entity',
                '@name': 'NotAService'
            }
        };
    });

    describe('constructor', () => {
        it('should initialize with default buckets', () => {
            const reader = new AnnotationReader(definitions);
            expect(reader.buckets).toEqual(['@ORD.dataProduct', '@']);
        });

        it('should initialize with custom buckets', () => {
            const reader = new AnnotationReader(definitions, ['@transformer']);
            expect(reader.buckets).toEqual(['@transformer']);
        });

        it('should have instance-specific cache', () => {
            const reader1 = new AnnotationReader(definitions);
            const reader2 = new AnnotationReader(definitions);
            expect(reader1.cache).not.toBe(reader2.cache);
        });
    });

    describe('get()', () => {
        it('should throw error if key is not provided', () => {
            const reader = new AnnotationReader(definitions);
            expect(() => reader.get('TestService')).toThrow('AnnotationReader.get() requires a key parameter');
        });

        it('should return null for non-existent service', () => {
            const reader = new AnnotationReader(definitions);
            expect(reader.get('NonExistentService', 'name')).toBeNull();
        });

        it('should return null for non-service entities', () => {
            const reader = new AnnotationReader(definitions);
            expect(reader.get('NotAService', 'name')).toBeNull();
        });

        describe('with default buckets', () => {
            it('should find annotations with @ prefix', () => {
                const reader = new AnnotationReader(definitions, ['@ORD.dataProduct', '@']);
                expect(reader.get('TestService', 'name')).toBe('TestService');
                expect(reader.get('TestService', 'version')).toBe('1.0.0');
            });

            it('should find @DataIntegration.dataProduct annotations', () => {
                const reader = new AnnotationReader(definitions, ['@DataIntegration.dataProduct', '@']);
                expect(reader.get('TestService', 'type')).toBe('primary');
            });
        });

        describe('with transformer bucket', () => {
            it('should only find transformer annotations', () => {
                const reader = new AnnotationReader(definitions, ['@transformer']);
                expect(reader.get('TestService', 'name')).toBe('TestTransformer');
                expect(reader.get('TestService', 'dpdType')).toBe('analytical');
                // Should NOT find @name from root
                expect(reader.get('TestService', 'version')).toBeNull();
            });
        });

        describe('with share bucket', () => {
            it('should only find share annotations', () => {
                const reader = new AnnotationReader(definitions, ['@share']);
                expect(reader.get('TestService', 'isRuntimeExtensible')).toBe(true);
                expect(reader.get('TestService', 'includeEntities')).toEqual(['Entity1', 'Entity2']);
                // Should NOT find other annotations
                expect(reader.get('TestService', 'name')).toBeNull();
            });
        });

        describe('with csn bucket', () => {
            it('should only find csn annotations', () => {
                const reader = new AnnotationReader(definitions, ['@csn']);
                expect(reader.get('TestService', 'includeVirtual')).toBe(true);
                // Should NOT find other annotations
                expect(reader.get('TestService', 'name')).toBeNull();
            });
        });

        describe('caching behavior', () => {
            it('should cache values correctly', () => {
                const reader = new AnnotationReader(definitions, ['@']);
                
                // First call should compute and cache
                const result1 = reader.get('TestService', 'name');
                expect(result1).toBe('TestService');
                
                // Modify the definition (simulating mutation)
                definitions.TestService['@name'] = 'ModifiedName';
                
                // Second call should return cached value
                const result2 = reader.get('TestService', 'name');
                expect(result2).toBe('TestService'); // Still original value from cache
            });

            it('should use bucket-specific cache keys', () => {
                const reader1 = new AnnotationReader(definitions, ['@transformer']);
                const reader2 = new AnnotationReader(definitions, ['@']);
                
                // Both readers looking for 'name' should get different results
                expect(reader1.get('TestService', 'name')).toBe('TestTransformer');
                expect(reader2.get('TestService', 'name')).toBe('TestService');
            });

            it('should not share cache between instances', () => {
                const reader1 = new AnnotationReader(definitions, ['@transformer']);
                const reader2 = new AnnotationReader(definitions, ['@transformer']);
                
                // First reader gets and caches value
                expect(reader1.get('TestService', 'name')).toBe('TestTransformer');
                
                // Modify definition
                definitions.TestService['@transformer.name'] = 'ModifiedTransformer';
                
                // Second reader should see new value (not cached)
                expect(reader2.get('TestService', 'name')).toBe('ModifiedTransformer');
                
                // First reader still has cached value
                expect(reader1.get('TestService', 'name')).toBe('TestTransformer');
            });
        });
    });

    describe('getAll()', () => {
        it('should return empty object for non-service', () => {
            const reader = new AnnotationReader(definitions);
            expect(reader.getAll('NotAService')).toEqual({});
        });

        it('should get all annotations with default buckets', () => {
            const reader = new AnnotationReader(definitions, ['@']);
            const annotations = reader.getAll('TestService');
            
            expect(annotations).toMatchObject({
                name: 'TestService',
                version: '1.0.0',
                title: 'Test Service'
            });
        });

        it('should get only transformer annotations', () => {
            const reader = new AnnotationReader(definitions, ['@transformer']);
            const annotations = reader.getAll('TestService');
            
            expect(annotations).toEqual({
                name: 'TestTransformer',
                dpdType: 'analytical'
            });
        });

        it('should get only share annotations', () => {
            const reader = new AnnotationReader(definitions, ['@share']);
            const annotations = reader.getAll('TestService');
            
            expect(annotations).toEqual({
                isRuntimeExtensible: true,
                includeEntities: ['Entity1', 'Entity2']
            });
        });
    });

    describe('getAllNested()', () => {
        it('should convert flat annotations to nested structure', () => {
            // Add nested annotations
            definitions.TestService['@transformer.spark.version'] = '3.5.0';
            definitions.TestService['@transformer.spark.memory'] = '2g';
            
            const reader = new AnnotationReader(definitions, ['@transformer']);
            const nested = reader.getAllNested('TestService');
            
            expect(nested).toEqual({
                name: 'TestTransformer',
                dpdType: 'analytical',
                spark: {
                    version: '3.5.0',
                    memory: '2g'
                }
            });
        });
    });

    describe('isService()', () => {
        it('should return true for services', () => {
            const reader = new AnnotationReader(definitions);
            expect(reader.isService('TestService')).toBe(true);
            expect(reader.isService('AnotherService')).toBe(true);
        });

        it('should return false for non-services', () => {
            const reader = new AnnotationReader(definitions);
            expect(reader.isService('NotAService')).toBe(false);
            expect(reader.isService('NonExistent')).toBe(false);
        });
    });

    describe('hasDataProductAnnotations()', () => {
        it('should detect @DataIntegration annotations', () => {
            const reader = new AnnotationReader(definitions);
            expect(reader.hasDataProductAnnotations('TestService')).toBe(true);
        });

        it('should detect @ORD.dataProduct annotations', () => {
            const reader = new AnnotationReader(definitions);
            expect(reader.hasDataProductAnnotations('AnotherService')).toBe(true);
        });

        it('should return false for services without data product annotations', () => {
            definitions.PlainService = {
                kind: 'service',
                '@name': 'PlainService'
            };
            const reader = new AnnotationReader(definitions);
            expect(reader.hasDataProductAnnotations('PlainService')).toBe(false);
        });

        it('should return false for non-services', () => {
            const reader = new AnnotationReader(definitions);
            expect(reader.hasDataProductAnnotations('NotAService')).toBe(false);
        });
    });

    describe('getDataProducts()', () => {
        it('should return only services with data product annotations', () => {
            definitions.PlainService = {
                kind: 'service',
                '@name': 'PlainService'
            };
            
            const reader = new AnnotationReader(definitions);
            const dataProducts = reader.getDataProducts();
            
            expect(dataProducts).toContain('TestService');
            expect(dataProducts).toContain('AnotherService');
            expect(dataProducts).not.toContain('PlainService');
            expect(dataProducts).not.toContain('NotAService');
        });
    });

    describe('bucket fallback behavior', () => {
        it('should fallback to @ bucket when specific bucket not found', () => {
            const reader = new AnnotationReader(definitions, ['@nonexistent', '@']);
            expect(reader.get('TestService', 'name')).toBe('TestService');
        });

        it('should not fallback if @ bucket not included', () => {
            const reader = new AnnotationReader(definitions, ['@nonexistent']);
            expect(reader.get('TestService', 'name')).toBeNull();
        });

        it('should respect bucket order for precedence', () => {
            // Add conflicting annotation
            definitions.TestService['@ORD.dataProduct.name'] = 'ORDName';
            
            const reader1 = new AnnotationReader(definitions, ['@ORD.dataProduct', '@']);
            expect(reader1.get('TestService', 'name')).toBe('ORDName'); // ORD takes precedence
            
            const reader2 = new AnnotationReader(definitions, ['@', '@ORD.dataProduct']);
            expect(reader2.get('TestService', 'name')).toBe('TestService'); // @ takes precedence
        });
    });

    describe('edge cases', () => {
        it('should handle empty definitions', () => {
            const reader = new AnnotationReader({});
            expect(reader.get('AnyService', 'anyKey')).toBeNull();
            expect(reader.getAll('AnyService')).toEqual({});
            expect(reader.getDataProducts()).toEqual([]);
        });

        it('should handle null/undefined values correctly', () => {
            definitions.TestService['@nullable'] = null;
            // undefined values in objects are not enumerable, so they won't be found
            // The reader will return null for non-existent keys
            definitions.TestService['@false'] = false;
            definitions.TestService['@zero'] = 0;
            definitions.TestService['@empty'] = '';
            
            const reader = new AnnotationReader(definitions, ['@']);
            
            expect(reader.get('TestService', 'nullable')).toBeNull();
            expect(reader.get('TestService', 'undefined')).toBeNull(); // Non-existent keys return null
            expect(reader.get('TestService', 'false')).toBe(false);
            expect(reader.get('TestService', 'zero')).toBe(0);
            expect(reader.get('TestService', 'empty')).toBe('');
        });

        it('should handle complex nested structures', () => {
            definitions.TestService['@complex'] = {
                nested: {
                    deeply: {
                        value: 'found'
                    }
                },
                array: [1, 2, 3]
            };
            
            const reader = new AnnotationReader(definitions, ['@']);
            const complex = reader.get('TestService', 'complex');
            
            expect(complex).toEqual({
                nested: {
                    deeply: {
                        value: 'found'
                    }
                },
                array: [1, 2, 3]
            });
        });
    });
});