const { Logger } = require("../../logger");
const DEFAULTS = require("../defaults");

function buildTransformerObject(config, csn, appConfig) {
    const { name, version, namespace, serviceName, transformerConfig = {} } = config;
    const defaults = DEFAULTS.transformer;
    
    const transformer = {
        name: transformerConfig.name || serviceName,
        dpdType: transformerConfig.dpdType || defaults.dpdType,
        dpdVersion: transformerConfig.dpdVersion || defaults.dpdVersion,
        title: config.title || serviceName,
        version: version,
        unixCronScheduleInUTC: transformerConfig.cronSchedule || defaults.cronSchedule
    };
    
    if (transformerConfig.parameters) {
        transformer.parameters = transformerConfig.parameters;
    }
    
    transformer.sparkConfig = {
        sparkVersion: transformerConfig.sparkVersion || defaults.spark.version,
        packages: transformerConfig.packages || defaults.spark.packages,
        driverMemory: transformerConfig.driverMemory || defaults.spark.driverMemory,
        executorMemory: transformerConfig.executorMemory || defaults.spark.executorMemory
    };
    
    transformer.transformer = {
        stepKey: transformerConfig.stepKey || defaults.stepKey,
        application: transformerConfig.application || defaults.application,
        packageName: transformerConfig.package || defaults.packageName,
        packageVersion: transformerConfig.packageVersion || defaults.packageVersion,
        entryPoint: transformerConfig.entrypoint || defaults.entryPoint,
        sparkConfig: {
            sparkVersion: transformerConfig.sparkVersion || defaults.spark.version,
            packages: transformerConfig.packages || defaults.spark.packages
        }
    };
    
    if (transformerConfig.parameters) {
        transformer.transformer.parameters = transformerConfig.parameters;
    }
    
    Logger.info(`Built transformer object for ${serviceName}`);
    return transformer;
}

module.exports = {
    buildTransformerObject
};