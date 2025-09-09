// Single-responsibility helpers to assemble a Transformer v2 object

function pickDefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function resolveBaseProps(config, defaults) {
  const { serviceName, transformerConfig = {}, version, namespace } = config;
  return {
    dpdType: transformerConfig.dpdType || defaults.dpdType,
    dpdVersion: transformerConfig.dpdVersion || 'v2',
    name: transformerConfig.name || serviceName,
    namespace,
    version,
    unixCronScheduleInUTC: transformerConfig.cronSchedule || defaults.cronSchedule,
    parameters: transformerConfig.parameters,
  };
}

function buildSparkConfig(transformerConfig = {}, defaults) {
  const spark = pickDefined({
    sparkVersion: transformerConfig.sparkVersion || defaults.spark.version,
    packages: transformerConfig.packages || defaults.spark.packages,
    driverMemory: transformerConfig.driverMemory || defaults.spark.driverMemory,
    executorMemory: transformerConfig.executorMemory || defaults.spark.executorMemory,
  });
  return Object.keys(spark).length ? spark : undefined;
}

function buildSteps(transformerConfig = {}, defaults) {
  // v2 requires at least one step; we construct a single-step pipeline
  const step = pickDefined({
    stepKey: transformerConfig.stepKey || defaults.stepKey,
    packageName: transformerConfig.package || defaults.packageName,
    packageVersion: transformerConfig.packageVersion || defaults.packageVersion,
    entryPoint: transformerConfig.entrypoint || defaults.entryPoint,
  });
  return [step];
}

function buildTransformerV2(config, defaults) {
  const base = resolveBaseProps(config, defaults);
  const sparkConfig = buildSparkConfig(config.transformerConfig, defaults);
  const steps = buildSteps(config.transformerConfig, defaults);

  const transformer = pickDefined({
    ...base,
    sparkConfig,
    steps,
  });
  if (transformer.parameters === undefined) delete transformer.parameters;
  return transformer;
}

module.exports = {
  resolveBaseProps,
  buildSparkConfig,
  buildSteps,
  buildTransformerV2,
};

