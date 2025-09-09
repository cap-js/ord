const { getShareSchema, getSchemaSource } = require('./schemaService');
const { Logger } = require('../../logger');
const { compileValidator, validate } = require('../common/ajvValidator');

let initPromise = null;

async function initShareAjv() {
  if (initPromise) return initPromise;
  initPromise = getShareSchema()
    .then(schema => {
      const v = compileValidator('share', schema);
      try {
        if (getSchemaSource && getSchemaSource() === 'local') {
          Logger.warn('Share schema: remote fetch failed, using local copy');
        }
      } catch (_) {}
      return v;
    })
    .catch(() => null);
  return initPromise;
}

function validateShareWithAjv(obj) {
  try {
    validate('share', obj);
  } catch (e) {
    throw new Error(`Share schema validation failed: ${e.message}`);
  }
}

module.exports = {
  initShareAjv,
  validateShareWithAjv,
};
