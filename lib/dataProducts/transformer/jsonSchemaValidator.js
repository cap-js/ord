const { getTransformerV2Schema, getSchemaSource } = require('./schemaService');
const { compileValidator, validate } = require('../common/ajvValidator');
const { Logger } = require('../../logger');

let Ajv = null;
let addFormats = null;
try {
  Ajv = require('ajv');
  // Some bundlers expose default; handle both
  Ajv = Ajv.default || Ajv;
  addFormats = require('ajv-formats');
  addFormats = addFormats.default || addFormats;
} catch (e) {
  // Ajv not installed; caller should fallback to light validator
}

let compilePromise = null;

function initTransformerV2Ajv() {
  if (!Ajv) return; // no-op if Ajv not installed
  if (!compilePromise) {
    compilePromise = getTransformerV2Schema()
      .then(schema => {
        const v = compileValidator('transformer', schema);
        try {
          if (getSchemaSource && getSchemaSource() === 'local') {
            Logger.warn('Transformer schema: remote fetch failed, using local copy');
          }
        } catch (_) {}
        return v;
      })
      .catch(() => null);
  }
}

function validateTransformerV2WithAjv(obj) {
  if (!Ajv) throw new Error('Ajv not available');
  try {
    validate('transformer', obj);
  } catch (e) {
    throw new Error(`Transformer v2 schema validation failed: ${e.message}`);
  }
}

module.exports = {
  initTransformerV2Ajv,
  validateTransformerV2WithAjv,
};
