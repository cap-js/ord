const globalCache = new Map();

class AnnotationReader {
    constructor(definitions, buckets = ['@ORD.dataProduct', '@']) {
        this.definitions = definitions;
        this.buckets = buckets;
        this.cache = globalCache;
    }
    
    get(serviceName, key) {
        if (!key) {
            throw new Error('AnnotationReader.get() requires a key parameter');
        }
        
        const cacheKey = `${serviceName}:${key}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const definition = this.definitions[serviceName];
        if (!definition || definition.kind !== 'service') {
            this.cache.set(cacheKey, null);
            return null;
        }
        
        let value = null;
        
        if (key.startsWith('@')) {
            value = definition[key] || null;
        } else {
            for (const bucket of this.buckets) {
                if (bucket === '@') {
                    const directKey = '@' + key;
                    if (definition[directKey] !== undefined) {
                        value = definition[directKey];
                        break;
                    }
                } else {
                    const flatKey = bucket + '.' + key;
                    if (definition[flatKey] !== undefined) {
                        value = definition[flatKey];
                        break;
                    }
                    if (definition[bucket] && definition[bucket][key] !== undefined) {
                        value = definition[bucket][key];
                        break;
                    }
                }
            }
        }
        
        this.cache.set(cacheKey, value);
        return value;
    }
    
    getAll(serviceName) {
        const definition = this.definitions[serviceName];
        if (!definition || definition.kind !== 'service') {
            return {};
        }
        
        const annotations = {};
        
        for (const bucket of this.buckets) {
            if (bucket === '@') {
                for (const key in definition) {
                    if (key.startsWith('@') && !key.includes('.')) {
                        const cleanKey = key.substring(1);
                        if (!annotations[cleanKey]) {
                            annotations[cleanKey] = definition[key];
                        }
                    }
                }
            } else {
                const bucketPrefix = bucket + '.';
                for (const key in definition) {
                    if (key.startsWith(bucketPrefix)) {
                        const cleanKey = key.replace(bucketPrefix, '');
                        if (!annotations[cleanKey]) {
                            annotations[cleanKey] = definition[key];
                        }
                    }
                }
                if (definition[bucket]) {
                    for (const key in definition[bucket]) {
                        if (!annotations[key]) {
                            annotations[key] = definition[bucket][key];
                        }
                    }
                }
            }
        }
        
        return annotations;
    }
    
    getAllNested(serviceName) {
        const flatAnnotations = this.getAll(serviceName);
        return this.convertToNested(flatAnnotations);
    }
    
    convertToNested(flatAnnotations) {
        const nestedAnnotations = {};
        
        for (const [key, value] of Object.entries(flatAnnotations)) {
            const parts = key.split('.');
            
            if (parts.length > 1) {
                let current = nestedAnnotations;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) {
                        current[parts[i]] = {};
                    }
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = value;
            } else {
                nestedAnnotations[key] = value;
            }
        }
        
        return nestedAnnotations;
    }
    
    isService(name) {
        return this.definitions[name]?.kind === 'service';
    }
    
    hasDataProductAnnotations(serviceName) {
        if (!this.isService(serviceName)) return false;
        
        const definition = this.definitions[serviceName];
        
        // A service is a data product if it has:
        // 1. Data product annotations (@ORD.dataProduct.* or @dataProduct)
        // 2. OR Data integration annotations (@DataIntegration.*)
        
        for (const key in definition) {
            // Check for @ORD.dataProduct.* annotations
            if (key.startsWith('@ORD.dataProduct')) {
                return true;
            }
            
            // Check for @DataIntegration.* annotations
            if (key.startsWith('@DataIntegration')) {
                return true;
            }
            
            // Check for explicit @dataProduct annotation
            if (key === '@dataProduct') {
                return true;
            }
            
            // Check for @ORD.dataProducts (plural form)
            if (key === '@ORD.dataProducts') {
                return true;
            }
            
            // Check for simple @dataProducts annotation
            if (key === '@dataProducts') {
                return true;
            }
        }
        
        // If no data product or data integration annotations found, return false
        return false;
    }
    
    getDataProducts() {
        return Object.keys(this.definitions)
            .filter(name => this.isService(name) && this.hasDataProductAnnotations(name));
    }
}

module.exports = {
    AnnotationReader
};