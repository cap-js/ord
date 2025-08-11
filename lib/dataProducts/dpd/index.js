const cds = require("@sap/cds");
const { DPD_BUILD_DEFAULT_PATH } = require("./constants");

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
    DPD_BUILD_DEFAULT_PATH
};