function arrayify(v) {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined) return v;
  return [v];
}

const REGISTRY = {
  arrayify,
};

function resolveNormalizersMap(spec = {}) {
  const out = {};
  for (const [key, name] of Object.entries(spec)) {
    const fn = REGISTRY[name];
    if (typeof fn === 'function') out[key] = fn;
  }
  return out;
}

module.exports = {
  arrayify,
  resolveNormalizersMap,
};

