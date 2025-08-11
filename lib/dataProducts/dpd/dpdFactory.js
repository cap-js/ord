function buildDpdObject(config, csn, appConfig) {
    const namespace = appConfig?.ordNamespace || "your.namespace";
    const dpName = config.name || config.serviceName || config.localId;
    
    return {
        ...config,
        name: dpName,
        namespace: namespace,
        ordId: `${namespace}:dataProduct:${dpName}:v1`
    };
}

module.exports = {
    buildDpdObject
};