function buildDpdObject(config, csn, appConfig) {
    const namespace = appConfig?.ordNamespace || "your.namespace";
    const dpName = config.name || config.serviceName || config.localId;
    
    // Clean up the config by removing empty configs
    const cleanConfig = { ...config };
    
    // Remove transformerConfig if it's empty or has only null values
    if (cleanConfig.transformerConfig) {
        const hasValidValues = Object.values(cleanConfig.transformerConfig).some(
            value => value !== null && value !== undefined
        );
        if (!hasValidValues) {
            delete cleanConfig.transformerConfig;
        }
    }
    
    // Remove shareConfig if it's empty or has only null values
    if (cleanConfig.shareConfig) {
        const hasValidValues = Object.entries(cleanConfig.shareConfig).some(
            ([key, value]) => {
                // Check nested extensible object separately
                if (key === 'extensible' && typeof value === 'object') {
                    return Object.values(value).some(v => v !== null && v !== undefined);
                }
                return value !== null && value !== undefined;
            }
        );
        if (!hasValidValues) {
            delete cleanConfig.shareConfig;
        }
    }
    
    // Remove csnConfig if it's empty or has only null values
    if (cleanConfig.csnConfig) {
        const hasValidValues = Object.values(cleanConfig.csnConfig).some(
            value => value !== null && value !== undefined
        );
        if (!hasValidValues) {
            delete cleanConfig.csnConfig;
        }
    }
    
    return {
        ...cleanConfig,
        name: dpName,
        namespace: namespace,
        ordId: `${namespace}:dataProduct:${dpName}:v1`
    };
}

module.exports = {
    buildDpdObject
};