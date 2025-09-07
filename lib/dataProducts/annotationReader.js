const { Logger } = require('../logger');
const globalCache = new Map();

class AnnotationReader {
    constructor(definitions, buckets = ['@ORD.dataProduct', '@']) {
        this.definitions = definitions;
        this.buckets = buckets;
        // Use instance-specific cache to avoid cross-contamination between different readers
        this.cache = new Map();
        Logger.warn(`AnnotationReader created with definitions: ${JSON.stringify(definitions)}`);
        Logger.warn(`[ANNOTATION-DEBUG] AnnotationReader created with -- buckets: ${JSON.stringify(buckets)}`);
        Logger.debug(`AnnotationReader has ${Object.keys(definitions).length} definitions`);
    }

    get(serviceName, key) {
        if (!key) {
            throw new Error('AnnotationReader.get() requires a key parameter');
        }

        // Include bucket configuration in cache key to prevent cross-contamination
        const bucketId = this.buckets.join('|');
        const cacheKey = `${bucketId}:${serviceName}:${key}`;

        Logger.debug(`AnnotationReader.get('${serviceName}', '${key}') with buckets: ${bucketId}`);

        if (this.cache.has(cacheKey)) {
            const cachedValue = this.cache.get(cacheKey);
            Logger.debug(`  → Found in cache: ${JSON.stringify(cachedValue)}`);
            return cachedValue;
        }

        const definition = this.definitions[serviceName];
        if (!definition || definition.kind !== 'service') {
            Logger.debug(`  → Not a service or not found, returning null`);
            this.cache.set(cacheKey, null);
            return null;
        }

        let value = null;

        if (key.startsWith('@')) {
            Logger.debug(`  → Looking for full annotation key: ${key}`);
            value = definition[key] || null;
            if (value !== null) {
                Logger.debug(`    ✓ Found value: ${JSON.stringify(value)}`);
            }
        } else {
            Logger.debug(`  → Searching through buckets for key: ${key}`);
            for (const bucket of this.buckets) {
                Logger.debug(`    Checking bucket: ${bucket}`);
                if (bucket === '@') {
                    const directKey = '@' + key;
                    Logger.debug(`      Looking for: ${directKey}`);
                    if (definition[directKey] !== undefined) {
                        value = definition[directKey];
                        Logger.debug(`      ✓ Found at ${directKey}: ${JSON.stringify(value)}`);
                        break;
                    }
                } else {
                    const flatKey = bucket + '.' + key;
                    Logger.debug(`      Looking for flat key: ${flatKey}`);
                    if (definition[flatKey] !== undefined) {
                        value = definition[flatKey];
                        Logger.debug(`      ✓ Found at ${flatKey}: ${JSON.stringify(value)}`);
                        break;
                    }
                    Logger.debug(`      Looking for nested: ${bucket}[${key}]`);
                    if (definition[bucket] && definition[bucket][key] !== undefined) {
                        value = definition[bucket][key];
                        Logger.debug(`      ✓ Found at ${bucket}[${key}]: ${JSON.stringify(value)}`);
                        break;
                    }
                }
            }
        }

        Logger.debug(`  → Final value: ${JSON.stringify(value)}`);
        this.cache.set(cacheKey, value);
        return value;
    }

    getAll(serviceName) {
        Logger.debug(`AnnotationReader.getAll('${serviceName}')`);
        const definition = this.definitions[serviceName];
        if (!definition || definition.kind !== 'service') {
            Logger.debug(`  → Not a service or not found, returning empty object`);
            return {};
        }

        const annotations = {};

        for (const bucket of this.buckets) {
            Logger.debug(`  Processing bucket: ${bucket}`);
            if (bucket === '@') {
                for (const key in definition) {
                    if (key.startsWith('@') && !key.includes('.')) {
                        const cleanKey = key.substring(1);
                        if (!annotations[cleanKey]) {
                            annotations[cleanKey] = definition[key];
                            Logger.debug(`    Added ${cleanKey}: ${JSON.stringify(definition[key])}`);
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
                            Logger.debug(`    Added ${cleanKey} from ${bucketPrefix}: ${JSON.stringify(definition[key])}`);
                        }
                    }
                }
                if (definition[bucket]) {
                    for (const key in definition[bucket]) {
                        if (!annotations[key]) {
                            annotations[key] = definition[bucket][key];
                            Logger.debug(`    Added ${key} from nested ${bucket}: ${JSON.stringify(definition[bucket][key])}`);
                        }
                    }
                }
            }
        }

        Logger.debug(`  → Total annotations found: ${Object.keys(annotations).length}`);
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
        Logger.debug(`AnnotationReader.hasDataProductAnnotations('${serviceName}')`);

        if (!this.isService(serviceName)) {
            Logger.debug(`  → Not a service, returning false`);
            return false;
        }

        const definition = this.definitions[serviceName];

        // A service is a data product if it has:
        // 1. Data product annotations (@ORD.dataProduct.* or @dataProduct)
        // 2. OR Data integration annotations (@DataIntegration.*)

        for (const key in definition) {
            // Check for @ORD.dataProduct.* annotations
            if (key.startsWith('@ORD.dataProduct')) {
                Logger.debug(`  → Found ORD data product annotation: ${key}`);
                return true;
            }

            // Check for @DataIntegration.* annotations
            if (key.startsWith('@DataIntegration')) {
                Logger.debug(`  → Found DataIntegration annotation: ${key}`);
                return true;
            }

            // Check for explicit @dataProduct annotation
            if (key === '@dataProduct') {
                Logger.debug(`  → Found @dataProduct annotation`);
                return true;
            }

            // Check for @ORD.dataProducts (plural form)
            if (key === '@ORD.dataProducts') {
                Logger.debug(`  → Found @ORD.dataProducts annotation`);
                return true;
            }

            // Check for simple @dataProducts annotation
            if (key === '@dataProducts') {
                Logger.debug(`  → Found @dataProducts annotation`);
                return true;
            }
        }

        // If no data product or data integration annotations found, return false
        Logger.debug(`  → No data product annotations found`);
        return false;
    }

    getDataProducts() {
        Logger.debug('AnnotationReader.getDataProducts() - Searching for data products...');
        const services = Object.keys(this.definitions);
        const dataProducts = services.filter(name => this.isService(name) && this.hasDataProductAnnotations(name));
        Logger.debug(`  → Found ${dataProducts.length} data products out of ${services.length} definitions`);
        if (dataProducts.length > 0) {
            Logger.debug(`  → Data products: ${dataProducts.join(', ')}`);
        }
        return dataProducts;
    }
}

module.exports = {
    AnnotationReader
};
