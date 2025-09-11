const path = require('path');
const fs = require('fs');
const { loadSchemaWithFallback } = require('./schemaLoader');
const {
  getTransformerAnnotationConfig,
  getShareAnnotationConfig,
  getCsnAnnotationConfig,
  getDpdAnnotationConfig,
} = require('../config/configProvider');
const { Logger } = require('../../logger');

// Cache for loaded schemas and derived allowlists
const schemaCache = new Map();
const allowlistCache = new Map();

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

function deriveAllowedKeysFromSchema(schema) {
  if (!schema || typeof schema !== 'object') return [];
  const out = new Set();
  
  // Extract from top-level properties
  const props = schema.properties ? Object.keys(schema.properties) : [];
  props.forEach(k => out.add(k));
  
  // Extract from definitions
  const defs = schema.definitions || {};
  for (const defName of Object.keys(defs)) {
    const def = defs[defName] || {};
    const dprops = def.properties ? Object.keys(def.properties) : [];
    dprops.forEach(k => out.add(k));
  }
  
  return Array.from(out);
}

function mergeAllowlists(schemaKeys = [], configAllowlist = [], observedKeys = [], prefixes = []) {
  // Special case: if allowlist contains "*", allow all observed keys
  if (configAllowlist.includes('*')) {
    return observedKeys;
  }
  
  const allowed = new Set();
  
  // Add schema-derived keys
  schemaKeys.forEach(k => allowed.add(k));
  
  // Add config-defined allowlist
  configAllowlist.forEach(k => allowed.add(k));
  
  // Add keys matching prefixes
  for (const k of observedKeys) {
    if (prefixes.some(p => k.startsWith(p))) {
      allowed.add(k);
    }
  }
  
  return Array.from(allowed);
}

async function loadSchemaForArtifact(artifact, cfg) {
  const cacheKey = `${artifact}-schema`;
  
  // Check cache first
  if (schemaCache.has(cacheKey)) {
    return schemaCache.get(cacheKey);
  }
  
  try {
    const schemaUrl = cfg.schemaUrl;
    const localPath = resolveLocalSchemaPath(artifact, cfg.schemaLocalFile || 'schema.json');
    const res = await loadSchemaWithFallback(`${artifact}-allow`, schemaUrl, localPath);
    
    // Cache the loaded schema
    schemaCache.set(cacheKey, res.schema);
    Logger.info(`Loaded schema for ${artifact} from ${res.source}`);
    
    return res.schema;
  } catch (error) {
    Logger.warn(`Failed to load schema for ${artifact}: ${error.message}`);
    return null;
  }
}

async function getEffectiveAllowlist(artifact, observedKeys = []) {
  const cacheKey = `${artifact}-${observedKeys.sort().join(',')}`;
  
  // Check cache first
  if (allowlistCache.has(cacheKey)) {
    return allowlistCache.get(cacheKey);
  }
  
  const cfg = getConfigFor(artifact);
  if (!cfg) {
    Logger.warn(`No configuration found for artifact: ${artifact}`);
    return observedKeys; // Allow all if no config
  }
  
  const mode = cfg.allowlistMode || 'static';
  const configAllowlist = cfg.allowlist || [];
  const prefixes = cfg.allowedPrefixes || [];
  
  let effectiveAllowlist;
  
  if (mode === 'dynamic') {
    // Load schema and derive keys
    const schema = await loadSchemaForArtifact(artifact, cfg);
    const schemaKeys = schema ? deriveAllowedKeysFromSchema(schema) : [];
    effectiveAllowlist = mergeAllowlists(schemaKeys, configAllowlist, observedKeys, prefixes);
  } else {
    // Static mode - only use config allowlist and prefixes
    if (configAllowlist.length === 0 && prefixes.length === 0) {
      // If no static rules defined, allow all observed keys
      effectiveAllowlist = observedKeys;
    } else {
      effectiveAllowlist = mergeAllowlists([], configAllowlist, observedKeys, prefixes);
    }
  }
  
  // Cache the result
  allowlistCache.set(cacheKey, effectiveAllowlist);
  
  return effectiveAllowlist;
}

// Initialize schemas at startup for better performance
async function initializeSchemas() {
  const artifacts = ['transformer', 'share', 'csn', 'dataproduct'];
  
  for (const artifact of artifacts) {
    const cfg = getConfigFor(artifact);
    if (cfg && cfg.allowlistMode === 'dynamic') {
      try {
        await loadSchemaForArtifact(artifact, cfg);
      } catch (error) {
        Logger.warn(`Failed to preload schema for ${artifact}: ${error.message}`);
      }
    }
  }
  
  Logger.info('Schema allowlist service initialized');
}

module.exports = {
  getEffectiveAllowlist,
  initializeSchemas,
  deriveAllowedKeysFromSchema,
  mergeAllowlists,
};