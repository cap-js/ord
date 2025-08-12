const readerCache = new Map();

function createAnnotationReader(bucketName, definitions) {
    if (readerCache.has(bucketName)) {
        return readerCache.get(bucketName);
    }
    
    const bucketPrefix = bucketName + '.';
    const annotations = new Map();
    
    for (const [name, definition] of Object.entries(definitions)) {
        if (definition.kind === 'service') {
            const extracted = extractAnnotations(definition, bucketName, bucketPrefix);
            if (extracted) {
                annotations.set(name, extracted);
            }
        }
    }
    
    const reader = {
        get: (serviceName) => annotations.get(serviceName),
        has: (serviceName) => annotations.has(serviceName),
        getAll: () => Array.from(annotations.entries()),
        getAllServices: () => Array.from(annotations.keys())
    };
    
    readerCache.set(bucketName, reader);
    
    return reader;
}

function extractAnnotations(definition, bucketName, bucketPrefix) {
    const annotations = {};
    
    for (const key in definition) {
        if (key.startsWith(bucketPrefix)) {
            const propName = key.replace(bucketPrefix, '');
            annotations[propName] = definition[key];
        }
    }
    
    if (definition[bucketName]) {
        Object.assign(annotations, definition[bucketName]);
    }
    
    return Object.keys(annotations).length > 0 ? unflatten(annotations) : null;
}

function unflatten(obj) {
    const result = {};
    for (const key in obj) {
        setValue(result, key, obj[key]);
    }
    return result;
}

function setValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
            current[keys[i]] = {};
        }
        current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
}

module.exports = {
    createAnnotationReader
};