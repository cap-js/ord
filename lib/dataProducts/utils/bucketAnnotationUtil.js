// Utility to merge all annotations from a bucket-specific reader
// into a target config object with optional key transforms and nesting.

function deepSet(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] === undefined || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function applyBucketAnnotations(serviceName, reader, options = {}) {
  const {
    target = null,           // e.g. 'transformerConfig', 'shareConfig'
    allow = '*',             // '*' or array of allowed keys
    deny = [],               // array of keys to exclude
    alias = {},              // map: sourceKey -> targetKey
    nestedPaths = true,      // if true, dot paths create nested objects
    normalizers = {},        // map: key -> (value) => normalizedValue
    keepFalsy = true,        // include false, 0, ''
  } = options;

  const all = reader.getAll(serviceName) || {};

  const keys = Object.keys(all).filter(k => {
    const allowed = allow === '*' || allow.includes(k);
    const denied = deny.includes(k);
    return allowed && !denied;
  });

  const out = {};
  for (const key of keys) {
    let value = all[key];
    if (value === null || value === undefined) continue; // skip null/undefined
    if (!keepFalsy && (value === false || value === 0 || value === '')) continue;

    const normalized = normalizers[key] ? normalizers[key](value) : value;
    const targetKey = alias[key] || key;

    if (nestedPaths && targetKey.includes('.')) {
      deepSet(out, targetKey, normalized);
    } else {
      out[targetKey] = normalized;
    }
  }

  if (target) {
    if (Object.keys(out).length === 0) return {};
    return { [target]: out };
  }
  return out;
}

module.exports = {
  applyBucketAnnotations,
};

