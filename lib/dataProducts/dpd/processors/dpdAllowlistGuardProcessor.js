const BaseProcessor = require('../../processors/baseProcessor');
const { Logger } = require('../../../logger');
const { mergeAllowlist } = require('../../common/allowlist');
const { getDpdAnnotationConfig } = require('../../config/configProvider');
const { getEffectiveAllowlistSync } = require('../../common/schemaAllowlistService');
const { AnnotationReader } = require('../../annotationReader');

class DpdAllowlistGuardProcessor extends BaseProcessor {
  process(dataProducts, context) {
    try {
      const { csn } = context;
      const cfg = getDpdAnnotationConfig();
      for (const serviceName of Object.keys(csn.definitions)) {
        // Restricted reader only for DPD buckets
        const reader = new AnnotationReader(csn.definitions, ['@DataIntegration.dataProduct', '@ORD.dataProduct']);
        const all = reader.getAll(serviceName) || {};
        const observed = Object.keys(all);
        if (observed.length === 0) continue;
        const effectiveAllow = getEffectiveAllowlistSync('dataproduct', observed);
        for (const k of observed) {
          if (!effectiveAllow.includes(k)) {
            Logger.warn(`@dataProduct annotation ignored (not in schema allowlist): ${serviceName} -> '${k}'`);
          }
        }
      }
    } catch (e) {
      Logger.warn(`DpdAllowlistGuardProcessor skipped: ${e.message}`);
    }
    return dataProducts;
  }
}

module.exports = DpdAllowlistGuardProcessor;
