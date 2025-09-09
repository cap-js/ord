const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);

function readJson(relPath) {
  const p = path.join(ROOT, relPath);
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function getTransformerAnnotationConfig() {
  return readJson('annotations/transformer.json');
}

function getShareAnnotationConfig() {
  return readJson('annotations/share.json');
}

// Note: Transformer and Share schema settings are embedded in their annotations configs.

function getCsnAnnotationConfig() {
  return readJson('annotations/csn.json');
}

function getDpdAnnotationConfig() {
  return readJson('annotations/dpd.json');
}

module.exports = {
  getTransformerAnnotationConfig,
  getShareAnnotationConfig,
  getCsnAnnotationConfig,
  getDpdAnnotationConfig,
};
