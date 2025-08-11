const { Logger } = require("../../logger");

function buildDpd(config, csn, appConfig) {
    const namespace = appConfig?.ordNamespace || "customer.sample";
    
    const dpName = config.name || config.serviceName || config.localId;
    
    const dpd = {
        name: dpName,
        version: config.version || "1.0.0",
        title: config.title,
        description: config.description,
        type: config.type || "primary",
        namespace: namespace,
        ordId: `${namespace}:dataProduct:${dpName}:v1`
    };
    
    return dpd;
}

module.exports = {
    buildDpd
};