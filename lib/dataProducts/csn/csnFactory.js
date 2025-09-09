const { Logger } = require("../../logger");
const DEFAULTS = require("../defaults");
const { compileValidator, validate } = require('../common/ajvValidator');
const { getCsnAnnotationConfig } = require('../config/configProvider');
const { loadSchemaWithFallback } = require('../common/schemaLoader');
let csnInitPromise = null;

function buildCsnObject(config, csn, appConfig) {
    if (!csnInitPromise) {
        try {
            const cfg = getCsnAnnotationConfig();
            const localPath = require('path').join(__dirname, '..', 'config', 'schemas', cfg.schemaLocalFile);
            csnInitPromise = loadSchemaWithFallback('csn', cfg.schemaUrl, localPath)
                .then(res => {
                    const v = compileValidator('csn', res.schema);
                    try {
                        if (res.source === 'local') {
                            const { Logger } = require('../../logger');
                            Logger.warn('CSN schema: remote fetch failed, using local copy');
                        }
                    } catch (_) {}
                    return v;
                })
                .catch(() => null);
        } catch (_) {}
    }
    const { name, version, namespace, serviceName, csnConfig = {} } = config;
    const defaults = DEFAULTS.csn;
    
    const modifiedCsn = JSON.parse(JSON.stringify(csn));
    
    modifiedCsn.csnInteropEffective = csnConfig.formatVersion || defaults.formatVersion;
    modifiedCsn["$id"] = csnConfig.id || defaults.id;
    
    if (!modifiedCsn.meta) {
        modifiedCsn.meta = {};
    }
    
    modifiedCsn.meta["__name"] = serviceName;
    modifiedCsn.meta["__namespace"] = namespace;
    modifiedCsn.meta.document = {
        version: version
    };
    
    // Add metadata if configured to include it
    const includeMetadata = csnConfig.includeMetadata !== undefined 
        ? csnConfig.includeMetadata 
        : defaults.includeMetadata;
    if (includeMetadata) {
        modifiedCsn.meta.creator = modifiedCsn.meta.creator || csnConfig.creator || defaults.creator;
    }
    
    removePrimaryData(serviceName, modifiedCsn, csnConfig);
    removeTransformationFields(serviceName, modifiedCsn);
    removeDataProductFields(serviceName, modifiedCsn);
    
    // Apply configuration-based filtering with defaults
    const includeAnnotations = csnConfig.includeAnnotations !== undefined 
        ? csnConfig.includeAnnotations 
        : defaults.includeAnnotations;
    if (!includeAnnotations) {
        removeAllAnnotations(modifiedCsn);
    }
    
    const includeVirtual = csnConfig.includeVirtual !== undefined 
        ? csnConfig.includeVirtual 
        : defaults.includeVirtual;
    if (!includeVirtual) {
        removeVirtualAndComputedFields(modifiedCsn);
    }
    
    const pruneUnused = csnConfig.pruneUnused !== undefined 
        ? csnConfig.pruneUnused 
        : defaults.pruneUnused;
    if (pruneUnused) {
        pruneUnusedDefinitions(modifiedCsn, serviceName);
    }
    
    const includePrivate = csnConfig.includePrivate !== undefined 
        ? csnConfig.includePrivate 
        : defaults.includePrivate;
    if (!includePrivate) {
        removePrivateEntities(modifiedCsn);
    }
    
    const includeAbstract = csnConfig.includeAbstract !== undefined 
        ? csnConfig.includeAbstract 
        : defaults.includeAbstract;
    if (!includeAbstract) {
        removeAbstractEntities(modifiedCsn);
    }
    
    const shouldFlattenAssociations = csnConfig.flattenAssociations !== undefined 
        ? csnConfig.flattenAssociations 
        : defaults.flattenAssociations;
    if (shouldFlattenAssociations) {
        flattenAssociations(modifiedCsn);
    }
    
    const shouldExpandStructures = csnConfig.expandStructures !== undefined 
        ? csnConfig.expandStructures 
        : defaults.expandStructures;
    if (shouldExpandStructures) {
        expandStructuredTypes(modifiedCsn);
    }
    
    removeQueryFields(modifiedCsn);
    
    try { validate('csn', modifiedCsn); } catch (e) { Logger.warn(`CSN schema check: ${e.message}`); }
    Logger.info(`Built CSN object for ${serviceName}`);
    return modifiedCsn;
}

function removePrimaryData(serviceName, csnData, csnConfig = {}) {
    const entitiesArray = {};
    
    Object.keys(csnData.definitions).forEach((key) => {
        if (key.startsWith(serviceName)) {
            entitiesArray[key] = csnData.definitions[key];
        }
    });
    
    csnData.definitions = entitiesArray;
}

function removeTransformationFields(serviceName, csnData) {
    if (csnData.definitions[serviceName]) {
        Object.keys(csnData.definitions[serviceName]).forEach((key) => {
            if (key.startsWith("@transformer")) {
                delete csnData.definitions[serviceName][key];
            }
        });
    }
}

function removeDataProductFields(serviceName, csnData) {
    if (csnData.definitions[serviceName]) {
        delete csnData.definitions[serviceName]["@dataProducts"];
        delete csnData.definitions[serviceName];
        
        const keysToTransform = Object.keys(csnData.definitions)
            .filter(key => key.startsWith(`${serviceName}.`));
            
        keysToTransform.forEach(key => {
            const newKey = key.split('.').slice(1).join('.');
            csnData.definitions[newKey] = csnData.definitions[key];
            delete csnData.definitions[key];
        });
    }
}

function removeVirtualAndComputedFields(csnData) {
    Object.keys(csnData.definitions).forEach((defKey) => {
        const definition = csnData.definitions[defKey];
        
        if (definition.elements) {
            Object.keys(definition.elements).forEach((elementKey) => {
                const element = definition.elements[elementKey];
                
                if (element.virtual || element['@Core.Computed']) {
                    delete definition.elements[elementKey];
                }
            });
        }
    });
}

function removeQueryFields(csnData) {
    Object.keys(csnData.definitions).forEach((key) => {
        if (csnData.definitions[key].query) {
            delete csnData.definitions[key].query;
        }
    });
}

function removeAllAnnotations(csnData) {
    Object.keys(csnData.definitions).forEach((defKey) => {
        const definition = csnData.definitions[defKey];
        
        // Remove annotations from entity level
        Object.keys(definition).forEach((key) => {
            if (key.startsWith('@')) {
                delete definition[key];
            }
        });
        
        // Remove annotations from element level
        if (definition.elements) {
            Object.keys(definition.elements).forEach((elementKey) => {
                const element = definition.elements[elementKey];
                Object.keys(element).forEach((key) => {
                    if (key.startsWith('@')) {
                        delete element[key];
                    }
                });
            });
        }
    });
}

function pruneUnusedDefinitions(csnData, serviceName) {
    // This would require dependency analysis
    // For now, just keep service-related definitions
    Logger.info(`Pruning unused definitions for ${serviceName}`);
}

function removePrivateEntities(csnData) {
    Object.keys(csnData.definitions).forEach((key) => {
        if (csnData.definitions[key]['@private'] === true) {
            delete csnData.definitions[key];
        }
    });
}

function removeAbstractEntities(csnData) {
    Object.keys(csnData.definitions).forEach((key) => {
        if (csnData.definitions[key].abstract === true) {
            delete csnData.definitions[key];
        }
    });
}

function flattenAssociations(csnData) {
    Object.keys(csnData.definitions).forEach((defKey) => {
        const definition = csnData.definitions[defKey];
        
        if (definition.elements) {
            Object.keys(definition.elements).forEach((elementKey) => {
                const element = definition.elements[elementKey];
                
                if (element.type === 'cds.Association' || element.type === 'cds.Composition') {
                    // Convert association to foreign key reference
                    element.type = 'cds.String';
                    delete element.target;
                    delete element.on;
                    delete element.keys;
                }
            });
        }
    });
}

function expandStructuredTypes(csnData) {
    Object.keys(csnData.definitions).forEach((defKey) => {
        const definition = csnData.definitions[defKey];
        
        if (definition.elements) {
            const expandedElements = {};
            
            Object.keys(definition.elements).forEach((elementKey) => {
                const element = definition.elements[elementKey];
                
                if (element.elements) {
                    // Flatten structured type
                    Object.keys(element.elements).forEach((subKey) => {
                        expandedElements[`${elementKey}_${subKey}`] = element.elements[subKey];
                    });
                } else {
                    expandedElements[elementKey] = element;
                }
            });
            
            definition.elements = expandedElements;
        }
    });
}

module.exports = {
    buildCsnObject
};
