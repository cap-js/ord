const path = require('path');
const fs = require('fs');
const { loadSchemaWithFallback } = require('./schemaLoader');
const { deriveAllowedKeysFromSchema, mergeAllowlist } = require('./allowlist');
const {
  getTransformerAnnotationConfig,
  getShareAnnotationConfig,
  getCsnAnnotationConfig,
  getDpdAnnotationConfig,
} = require('../config/configProvider');

function getConfigFor(artifact) {
  switch (artifact) {
    case 'transformer': return getTransformerAnnotationConfig();
    case 'share': return getShareAnnotationConfig();
    case 'csn': return getCsnAnnotationConfig();
    case 'dataproduct': return getDpdAnnotationConfig();
    default: return null;
  }
}

function resolveLocalSchemaPath(artifact, schemaLocalFile) {
  // Prefer annotations folder for artifact-local schema; fallback to config/schemas
  const annotationsPath = path.join(__dirname, '..', 'config', 'annotations', schemaLocalFile);
  if (fs.existsSync(annotationsPath)) return annotationsPath;
  return path.join(__dirname, '..', 'config', 'schemas', schemaLocalFile);
}

async function getEffectiveAllowlist(artifact, observedKeys = []) {
  const cfg = getConfigFor(artifact) || { allow: '*', allowedPrefixes: [] };
  const schemaUrl = cfg.schemaUrl;
  const localPath = resolveLocalSchemaPath(artifact, cfg.schemaLocalFile || 'schema.json');
  let schemaKeys = [];
  try {
    const res = await loadSchemaWithFallback(`${artifact}-allow`, schemaUrl, localPath);
    schemaKeys = deriveAllowedKeysFromSchema(res.schema);
  } catch (_) {
    // ignore, will fallback to config-only allowlist
  }
  return mergeAllowlist(schemaKeys, cfg, observedKeys);
}

module.exports = {
  getEffectiveAllowlist,
};

function getEffectiveAllowlistSync(artifact, observedKeys = []) {
  const cfg = getConfigFor(artifact) || { allow: '*', allowedPrefixes: [] };
  // Synchronous fallback: merge config only; schema-derived keys will be added when async loader runs elsewhere
  return mergeAllowlist([], cfg, observedKeys);
}

module.exports.getEffectiveAllowlistSync = getEffectiveAllowlistSync;
