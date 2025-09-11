const { applyBucketAnnotations } = require('../../../../lib/dataProducts/utils/bucketAnnotationUtil');

describe('bucketAnnotationUtil', () => {
    describe('applyBucketAnnotations', () => {
        let mockReader;

        beforeEach(() => {
            mockReader = {
                getAll: jest.fn()
            };
        });

        it('should return empty object when reader returns null', () => {
            mockReader.getAll.mockReturnValue(null);
            
            const result = applyBucketAnnotations('TestService', mockReader);
            
            expect(result).toEqual({});
            expect(mockReader.getAll).toHaveBeenCalledWith('TestService');
        });

        it('should return empty object when reader returns empty object', () => {
            mockReader.getAll.mockReturnValue({});
            
            const result = applyBucketAnnotations('TestService', mockReader);
            
            expect(result).toEqual({});
        });

        it('should filter by allow list when allow is array', () => {
            mockReader.getAll.mockReturnValue({
                name: 'test',
                version: '1.0.0',
                description: 'desc',
                extra: 'value'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: ['name', 'version']
            });
            
            expect(result).toEqual({
                name: 'test',
                version: '1.0.0'
            });
        });

        it('should allow all keys when allow is "*"', () => {
            mockReader.getAll.mockReturnValue({
                name: 'test',
                version: '1.0.0',
                description: 'desc'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*'
            });
            
            expect(result).toEqual({
                name: 'test',
                version: '1.0.0',
                description: 'desc'
            });
        });

        it('should allow all keys when allow array contains "*"', () => {
            mockReader.getAll.mockReturnValue({
                name: 'test',
                version: '1.0.0',
                description: 'desc',
                extra: 'value'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: ['*']
            });
            
            expect(result).toEqual({
                name: 'test',
                version: '1.0.0',
                description: 'desc',
                extra: 'value'
            });
        });

        it('should exclude keys in deny list', () => {
            mockReader.getAll.mockReturnValue({
                name: 'test',
                version: '1.0.0',
                internal: 'secret'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*',
                deny: ['internal']
            });
            
            expect(result).toEqual({
                name: 'test',
                version: '1.0.0'
            });
        });

        it('should apply aliases to keys', () => {
            mockReader.getAll.mockReturnValue({
                packageName: 'com.example',
                entryPoint: 'main'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*',
                alias: {
                    packageName: 'package',
                    entryPoint: 'entrypoint'
                }
            });
            
            expect(result).toEqual({
                package: 'com.example',
                entrypoint: 'main'
            });
        });

        it('should apply normalizers to values', () => {
            mockReader.getAll.mockReturnValue({
                items: 'single',
                count: '42'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*',
                normalizers: {
                    items: (value) => [value],
                    count: (value) => parseInt(value, 10)
                }
            });
            
            expect(result).toEqual({
                items: ['single'],
                count: 42
            });
        });

        it('should create nested objects when nestedPaths is true', () => {
            mockReader.getAll.mockReturnValue({
                'user.name': 'John',
                'user.email': 'john@example.com',
                'settings.theme': 'dark'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*',
                nestedPaths: true
            });
            
            expect(result).toEqual({
                user: {
                    name: 'John',
                    email: 'john@example.com'
                },
                settings: {
                    theme: 'dark'
                }
            });
        });

        it('should not create nested objects when nestedPaths is false', () => {
            mockReader.getAll.mockReturnValue({
                'user.name': 'John',
                'settings.theme': 'dark'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*',
                nestedPaths: false
            });
            
            expect(result).toEqual({
                'user.name': 'John',
                'settings.theme': 'dark'
            });
        });

        it('should wrap result in target object when target is specified', () => {
            mockReader.getAll.mockReturnValue({
                name: 'test'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*',
                target: 'config'
            });
            
            expect(result).toEqual({
                config: {
                    name: 'test'
                }
            });
        });

        it('should return empty object when target specified but no data', () => {
            mockReader.getAll.mockReturnValue({});
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*',
                target: 'config'
            });
            
            expect(result).toEqual({});
        });

        it('should skip null and undefined values', () => {
            mockReader.getAll.mockReturnValue({
                name: 'test',
                nullValue: null,
                undefinedValue: undefined,
                zero: 0,
                empty: '',
                false: false
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*'
            });
            
            expect(result).toEqual({
                name: 'test',
                zero: 0,
                empty: '',
                false: false
            });
        });

        it('should exclude falsy values when keepFalsy is false', () => {
            mockReader.getAll.mockReturnValue({
                name: 'test',
                zero: 0,
                empty: '',
                false: false
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*',
                keepFalsy: false
            });
            
            expect(result).toEqual({
                name: 'test'
            });
        });

        it('should handle complex nested paths with aliases and normalizers', () => {
            mockReader.getAll.mockReturnValue({
                'spark.version': '3.0',
                'spark.packages': 'com.example:lib:1.0',
                'cron': '0 0 * * *'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*',
                alias: {
                    'spark.version': 'sparkVersion',
                    'spark.packages': 'sparkPackages',
                    'cron': 'cronSchedule'
                },
                normalizers: {
                    'spark.packages': (value) => value.split(',')
                },
                nestedPaths: false
            });
            
            expect(result).toEqual({
                sparkVersion: '3.0',
                sparkPackages: ['com.example:lib:1.0'],
                cronSchedule: '0 0 * * *'
            });
        });

        it('should handle nested paths with dots in aliased keys', () => {
            mockReader.getAll.mockReturnValue({
                oldKey: 'value'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*',
                alias: {
                    oldKey: 'new.nested.key'
                },
                nestedPaths: true
            });
            
            expect(result).toEqual({
                new: {
                    nested: {
                        key: 'value'
                    }
                }
            });
        });

        it('should overwrite existing nested values when creating paths', () => {
            mockReader.getAll.mockReturnValue({
                'a.b': 'value1',
                'a.b.c': 'value2'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*',
                nestedPaths: true
            });
            
            // The second value should overwrite since a.b can't be both a string and object
            expect(result).toEqual({
                a: {
                    b: {
                        c: 'value2'
                    }
                }
            });
        });

        it('should apply all transformations in correct order', () => {
            mockReader.getAll.mockReturnValue({
                allowedKey: 'value1',
                deniedKey: 'value2',
                aliasKey: 'value3',
                normalizeKey: 'value4,value5'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: ['allowedKey', 'aliasKey', 'normalizeKey'],
                deny: ['deniedKey'],
                alias: {
                    aliasKey: 'renamed.key'
                },
                normalizers: {
                    normalizeKey: (value) => value.split(',')
                },
                nestedPaths: true,
                target: 'processed'
            });
            
            expect(result).toEqual({
                processed: {
                    allowedKey: 'value1',
                    renamed: {
                        key: 'value3'
                    },
                    normalizeKey: ['value4', 'value5']
                }
            });
        });

        it('should handle empty options with default behavior', () => {
            mockReader.getAll.mockReturnValue({
                key1: 'value1',
                key2: 'value2'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader);
            
            // Default behavior: allow all, no deny, no alias, nested paths enabled
            expect(result).toEqual({
                key1: 'value1',
                key2: 'value2'
            });
        });

        it('should handle normalizer that returns undefined', () => {
            mockReader.getAll.mockReturnValue({
                key: 'value'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*',
                normalizers: {
                    key: () => undefined
                }
            });
            
            expect(result).toEqual({});
        });

        it('should handle normalizer that returns null', () => {
            mockReader.getAll.mockReturnValue({
                key: 'value'
            });
            
            const result = applyBucketAnnotations('TestService', mockReader, {
                allow: '*',
                normalizers: {
                    key: () => null
                }
            });
            
            expect(result).toEqual({ key: null });
        });
    });
});