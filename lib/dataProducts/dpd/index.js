const cds = require("@sap/cds");
const { DPD_BUILD_DEFAULT_PATH } = require("./constants");
const { validateDpd } = require("./validator");
const { buildDpd } = require("./dpdFactory");

/**
 * Check if DPD generation is enabled
 * @returns {boolean}
 */
function isDpdGenerationEnabled() {
    return cds.env.dpd?.dataProducts?.enabled === true;
}

module.exports = {
    isDpdGenerationEnabled,
    generateDpdFiles: require('./generator').generateDpdFiles,
    validateDpd,
    buildDpd,
    DPD_BUILD_DEFAULT_PATH
};