const { getTransformerV2Schema } = require('./schemaService');

let cachedAnnotationAllowlist = null;

// Lightweight validation using fetched schema: checks required fields and basic types only.
async function validateTransformerV2LightAsync(obj) {
  const schema = await getTransformerV2Schema();
  if (!schema) return; // silently skip if schema not available
  const errors = [];
  const req = schema.required || [];
  for (const k of req) {
    if (!(k in obj)) errors.push(`missing required key '${k}'`);
  }
  // steps array required
  if (Array.isArray(obj.steps)) {
    const defs = schema.definitions || {};
    const stepReq = (defs.Step && defs.Step.required) || [];
    if (obj.steps.length === 0) errors.push('steps must have at least one item');
    else {
      for (const key of stepReq) {
        if (!(key in obj.steps[0])) errors.push(`steps[0] missing required key '${key}'`);
      }
    }
  }
  if (errors.length) throw new Error(errors.join('; '));
}

function validateTransformerV2Light(obj) {
  // Fire and forget async; but also run a synchronous quick check for minimum keys
  // Synchronous minimal check
  const minReq = ['dpdType', 'dpdVersion', 'name', 'namespace', 'version', 'unixCronScheduleInUTC', 'steps'];
  for (const k of minReq) {
    if (!(k in obj)) throw new Error(`missing required key '${k}'`);
  }
  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    throw new Error('steps must be a non-empty array');
  }
  const stepMin = ['stepKey', 'packageName', 'packageVersion', 'entryPoint'];
  for (const k of stepMin) {
    if (!(k in obj.steps[0])) throw new Error(`steps[0] missing required key '${k}'`);
  }
  // Async fetch and extended check in the background; ignore errors
  // so we don't break builds without network
  validateTransformerV2LightAsync(obj).catch(() => {});
}

module.exports = {
  validateTransformerV2Light,
};

// Build an allowlist of annotation keys derived from schema
async function buildAnnotationAllowlistFromSchema() {
  const schema = await getTransformerV2Schema();
  if (!schema) return null;
  const allow = new Set();
  const props = schema.properties ? Object.keys(schema.properties) : [];
  // Allow direct top-level props that are meaningful as annotations
  for (const p of props) {
    // namespace/version are controlled by generator; skip them for annotations
    if (p === 'namespace' || p === 'version') continue;
    allow.add(p); // e.g., dpdType, dpdVersion, unixCronScheduleInUTC, parameters, maxExecutionTimeMinutes, sparkConfig, envConfig, computeConfig, libraries, steps, name
  }
  // Steps: allow flat keys for common step fields
  const defs = schema.definitions || {};
  const stepProps = (defs.Step && defs.Step.properties) ? Object.keys(defs.Step.properties) : [];
  for (const sp of stepProps) {
    // annotation keys are flat; keep them as-is
    allow.add(sp); // stepKey, packageName, packageVersion, entryPoint, parameters, etc.
  }
  // Known sparkConfig child keys commonly used as flat annotations
  const sparkFlat = ['sparkVersion', 'packages', 'driverMemory', 'executorMemory'];
  sparkFlat.forEach(k => allow.add(k));
  // Convenience aliases commonly used in annotations
  ['cronSchedule', 'entrypoint', 'package'].forEach(k => allow.add(k));
  // Also allow dotted spark.* annotations
  const allowedPrefixes = ['spark.'];
  return { allowedKeys: Array.from(allow), allowedPrefixes };
}

async function getTransformerV2AnnotationAllowlistAsync() {
  if (cachedAnnotationAllowlist) return cachedAnnotationAllowlist;
  const res = await buildAnnotationAllowlistFromSchema();
  if (res) cachedAnnotationAllowlist = res;
  return res;
}

function getTransformerV2AnnotationAllowlistSync() {
  // Minimal conservative allowlist if schema not loaded yet
  if (cachedAnnotationAllowlist) return cachedAnnotationAllowlist;
  return {
    allowedKeys: [
      'dpdType','dpdVersion','name','cronSchedule','parameters',
      'sparkVersion','packages','driverMemory','executorMemory',
      'stepKey','package','packageName','packageVersion','entryPoint','entrypoint'
    ],
    allowedPrefixes: ['spark.']
  };
}

module.exports.getTransformerV2AnnotationAllowlistAsync = getTransformerV2AnnotationAllowlistAsync;
module.exports.getTransformerV2AnnotationAllowlistSync = getTransformerV2AnnotationAllowlistSync;
