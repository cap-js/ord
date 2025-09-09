function deriveAllowedKeysFromSchema(schema) {
  if (!schema || typeof schema !== 'object') return [];
  const out = new Set();
  const props = schema.properties ? Object.keys(schema.properties) : [];
  props.forEach(k => out.add(k));
  const defs = schema.definitions || {};
  for (const defName of Object.keys(defs)) {
    const def = defs[defName] || {};
    const dprops = def.properties ? Object.keys(def.properties) : [];
    dprops.forEach(k => out.add(k));
  }
  return Array.from(out);
}

function mergeAllowlist(schemaKeys = [], cfg = {}, observedKeys = []) {
  const allowed = new Set(schemaKeys);
  if (cfg) {
    if (cfg.allow === '*') {
      observedKeys.forEach(k => allowed.add(k));
    } else if (Array.isArray(cfg.allow)) {
      cfg.allow.forEach(k => allowed.add(k));
    }
    const prefixes = Array.isArray(cfg.allowedPrefixes) ? cfg.allowedPrefixes : [];
    for (const k of observedKeys) {
      if (prefixes.some(p => k.startsWith(p))) allowed.add(k);
    }
  }
  return Array.from(allowed);
}

module.exports = {
  deriveAllowedKeysFromSchema,
  mergeAllowlist,
};

