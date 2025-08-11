const cds = require("@sap/cds");

/**
 * Check if DPD generation is enabled
 * @returns {boolean}
 */
function isDpdGenerationEnabled() {
    return cds.env.dpd?.dataProducts?.enabled === true;
}

module.exports = {
    isDpdGenerationEnabled,
    generateDpdFiles: require('./generator').generateDpdFiles
};