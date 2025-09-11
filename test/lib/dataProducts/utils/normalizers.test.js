const { resolveNormalizersMap, arrayify } = require('../../../../lib/dataProducts/utils/normalizers');

describe('normalizers', () => {
    describe('arrayify', () => {
        it('should return array as-is if already an array', () => {
            const input = ['a', 'b', 'c'];
            expect(arrayify(input)).toEqual(['a', 'b', 'c']);
            expect(arrayify(input)).toBe(input); // Same reference
        });

        it('should wrap non-array values in array', () => {
            expect(arrayify('string')).toEqual(['string']);
            expect(arrayify(42)).toEqual([42]);
            expect(arrayify(true)).toEqual([true]);
            expect(arrayify({ key: 'value' })).toEqual([{ key: 'value' }]);
        });

        it('should return null as-is', () => {
            expect(arrayify(null)).toBeNull();
        });

        it('should return undefined as-is', () => {
            expect(arrayify(undefined)).toBeUndefined();
        });

        it('should wrap empty string in array', () => {
            expect(arrayify('')).toEqual(['']);
        });

        it('should wrap zero in array', () => {
            expect(arrayify(0)).toEqual([0]);
        });

        it('should wrap false in array', () => {
            expect(arrayify(false)).toEqual([false]);
        });

        it('should handle empty array', () => {
            expect(arrayify([])).toEqual([]);
        });

        it('should handle nested arrays', () => {
            const nested = [['a', 'b'], ['c', 'd']];
            expect(arrayify(nested)).toEqual([['a', 'b'], ['c', 'd']]);
        });
    });

    describe('resolveNormalizersMap', () => {
        it('should throw error for null input', () => {
            expect(() => resolveNormalizersMap(null)).toThrow();
        });

        it('should return empty object for undefined input', () => {
            expect(resolveNormalizersMap(undefined)).toEqual({});
        });

        it('should return empty object for empty object input', () => {
            expect(resolveNormalizersMap({})).toEqual({});
        });

        it('should resolve "arrayify" string to arrayify function', () => {
            const config = {
                items: 'arrayify',
                tags: 'arrayify'
            };
            
            const result = resolveNormalizersMap(config);
            
            expect(result.items).toBe(arrayify);
            expect(result.tags).toBe(arrayify);
            expect(result.items('test')).toEqual(['test']);
        });

        it('should ignore unknown string normalizer names', () => {
            const config = {
                items: 'unknown',
                other: 'nonexistent'
            };
            
            const result = resolveNormalizersMap(config);
            
            expect(result.items).toBeUndefined();
            expect(result.other).toBeUndefined();
            expect(result).toEqual({});
        });

        it('should handle case-sensitive normalizer names', () => {
            const config = {
                correct: 'arrayify',
                wrong1: 'Arrayify',
                wrong2: 'ARRAYIFY',
                wrong3: 'arrayIfy'
            };
            
            const result = resolveNormalizersMap(config);
            
            expect(result.correct).toBe(arrayify);
            expect(result.wrong1).toBeUndefined();
            expect(result.wrong2).toBeUndefined();
            expect(result.wrong3).toBeUndefined();
            expect(Object.keys(result)).toEqual(['correct']);
        });

        it('should not modify the original config object', () => {
            const config = {
                items: 'arrayify'
            };
            
            const originalConfig = { ...config };
            resolveNormalizersMap(config);
            
            expect(config).toEqual(originalConfig);
        });
    });
});