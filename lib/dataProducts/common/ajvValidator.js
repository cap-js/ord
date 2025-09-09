let Ajv = null;
let addFormats = null;
try {
  // Use draft 2020-12 by default as schemas declare it
  Ajv = require('ajv/dist/2020');
  Ajv = Ajv.default || Ajv;
  addFormats = require('ajv-formats');
  addFormats = addFormats.default || addFormats;
} catch (e) {}

const validators = new Map(); // key -> compiled

function compileValidator(key, schema) {
  if (!Ajv) return null;
  if (validators.has(key)) return validators.get(key);
  const ajv = new Ajv({ allErrors: true, strict: false });
  if (addFormats) addFormats(ajv);
  const v = ajv.compile(schema);
  validators.set(key, v);
  return v;
}

function validate(key, obj) {
  const v = validators.get(key);
  if (!v) return; // not ready or Ajv absent
  const ok = v(obj);
  if (!ok) {
    const errs = (v.errors || []).map(e => `${e.instancePath || '(root)'} ${e.message}`).join('; ');
    throw new Error(errs || 'schema validation failed');
  }
}

module.exports = {
  compileValidator,
  validate,
};
