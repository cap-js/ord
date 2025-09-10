const { Logger } = require("../../logger");
const DEFAULTS = require("../defaults");
const { initShareAjv, validateShareWithAjv } = require("./jsonSchemaValidator");

function buildShareObject(config, csn, appConfig) {
    const { name, version, namespace, serviceName, shareConfig = {} } = config;
    const defaults = DEFAULTS.share;
    
    const share = {
        name: name,
        namespace: namespace,
        title: config.title || serviceName,
        shortDescription: config.shortDescription || "",
        description: config.description || "",
        version: version,
        extensible: shareConfig.extensible || {
            supported: defaults.extensible.supported,
            description: defaults.extensible.description
        },
        isRuntimeExtensible: shareConfig.isRuntimeExtensible !== undefined 
            ? shareConfig.isRuntimeExtensible 
            : defaults.isRuntimeExtensible,
        hdlfsSchemas: [
            {
                name: serviceName,
                shareTables: createShareTables(csn, serviceName, shareConfig)
            }
        ]
    };
    
    // Initialize schema validator asynchronously; validate if ready
    try { 
        initShareAjv(); 
    } catch (initError) {
        Logger.debug(`Share Ajv init skipped: ${initError.message}`);
    }
    
    try { 
        validateShareWithAjv(share); 
    } catch (validationError) { 
        Logger.warn(`Share schema validation failed for ${serviceName}: ${validationError.message}`); 
    }

    Logger.info(`Built share object for ${serviceName}`);
    return share;
}

function createShareTables(csn, serviceName, shareConfig = {}) {
    const shareTables = [];
    const servicePrefix = `${serviceName}.`;
    
    let entities = Object.keys(csn.definitions)
        .filter(key => key.startsWith(servicePrefix))
        .filter(key => csn.definitions[key].kind === 'entity');
    
    // Apply entity filters from shareConfig
    if (shareConfig.includeEntities && shareConfig.includeEntities.length > 0) {
        entities = entities.filter(entityFullName => {
            const entityName = entityFullName.substring(servicePrefix.length);
            return shareConfig.includeEntities.includes(entityName);
        });
    }
    
    if (shareConfig.excludeEntities && shareConfig.excludeEntities.length > 0) {
        entities = entities.filter(entityFullName => {
            const entityName = entityFullName.substring(servicePrefix.length);
            return !shareConfig.excludeEntities.includes(entityName);
        });
    }
    
    entities.forEach(entityFullName => {
        const entity = csn.definitions[entityFullName];
        const entityName = entityFullName.substring(servicePrefix.length);
        
        const shareTable = {
            name: entityName,
            columns: []
        };
        
        if (entity.elements) {
            for (const [fieldName, field] of Object.entries(entity.elements)) {
                const shouldInclude = shouldIncludeField(field, shareConfig);
                if (shouldInclude) {
                    // Apply column name mapping if configured
                    const mappedName = shareConfig.columnMapping && shareConfig.columnMapping[fieldName]
                        ? shareConfig.columnMapping[fieldName]
                        : fieldName;
                    
                    const column = {
                        name: mappedName,
                        type: mapCdsTypeToShareType(field.type, shareConfig.typeMapping)
                    };
                    
                    if (field.key) {
                        column.isKey = true;
                    }
                    
                    if (field.length) {
                        column.length = field.length;
                    }
                    
                    if (field.precision) {
                        column.precision = field.precision;
                    }
                    
                    if (field.scale) {
                        column.scale = field.scale;
                    }
                    
                    shareTable.columns.push(column);
                }
            }
        }
        
        if (shareTable.columns.length > 0) {
            shareTables.push(shareTable);
        }
    });
    
    return shareTables;
}

function shouldIncludeField(field, shareConfig) {
    const defaults = DEFAULTS.share;
    
    // Check virtual fields
    const includeVirtual = shareConfig.includeVirtual !== undefined 
        ? shareConfig.includeVirtual 
        : defaults.includeVirtual;
    if (field.virtual && !includeVirtual) {
        return false;
    }
    
    // Check computed fields
    const includeComputed = shareConfig.includeComputed !== undefined 
        ? shareConfig.includeComputed 
        : defaults.includeComputed;
    if (field['@Core.Computed'] === true && !includeComputed) {
        return false;
    }
    
    // Check managed fields (createdAt, createdBy, etc.)
    const managedFields = ['createdAt', 'createdBy', 'modifiedAt', 'modifiedBy'];
    const includeManaged = shareConfig.includeManaged !== undefined 
        ? shareConfig.includeManaged 
        : defaults.includeManaged;
    if (managedFields.includes(field.name) && !includeManaged) {
        return false;
    }
    
    return true;
}

function mapCdsTypeToShareType(cdsType, customTypeMapping = {}) {
    // Use type mapping from central defaults
    const defaultTypeMapping = DEFAULTS.typeMapping;
    
    // Apply custom type mapping if provided
    const typeMapping = { ...defaultTypeMapping, ...customTypeMapping };
    
    return typeMapping[cdsType] || 'string';
}

module.exports = {
    buildShareObject
};
