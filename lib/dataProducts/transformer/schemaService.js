const fs = require('fs');
const path = require('path');
const { getTransformerAnnotationConfig } = require('../config/configProvider');
const { loadSchemaWithFallback } = require('../common/schemaLoader');

let cachedSchema = null;
let schemaSource = null; // 'remote' | 'local'

async function getTransformerV2Schema() {
  if (cachedSchema) return cachedSchema;
  const schemaCfg = getTransformerAnnotationConfig();
  const localPath = path.join(__dirname, '..', 'config', 'annotations', schemaCfg.schemaLocalFile);
  const res = await loadSchemaWithFallback('transformer', schemaCfg.schemaUrl, localPath);
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
  getTransformerV2Schema,
  getSchemaSource,
  resetSchemaCache,
};
