const fs = require('fs');
const path = require('path');
const { getShareAnnotationConfig } = require('../config/configProvider');
const { loadSchemaWithFallback } = require('../common/schemaLoader');

let cachedSchema = null;
let schemaSource = null; // 'remote' | 'local'

async function getShareSchema() {
  if (cachedSchema) return cachedSchema;
  const cfg = getShareAnnotationConfig();
  const localPath = path.join(__dirname, '..', 'config', 'annotations', cfg.schemaLocalFile);
  const res = await loadSchemaWithFallback('share', cfg.schemaUrl, localPath);
  cachedSchema = res.schema;
  schemaSource = res.source;
  return cachedSchema;
}

function getSchemaSource() {
  return schemaSource;
}

function resetSchemaCache() {
  cachedSchema = null;
  schemaSource = null;
}

module.exports = {
  getShareSchema,
  getSchemaSource,
  resetSchemaCache,
};
