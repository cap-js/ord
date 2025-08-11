const { createDataProductProcessor } = require("../processors/processor");
const { buildDpdObject } = require("./dpdFactory");
const { Logger } = require("../../logger");

/**
 * Generate DPD files from CSN
 * @param {object} csn - Compiled Service Network
 * @param {object} appConfig - Application configuration
 * @returns {Array} - Array of DPD objects with filename and content
 */
function generateDpdFiles(csn, appConfig) {
    const dpdFiles = [];
    
    const processor = createDataProductProcessor();
    const context = { csn, appConfig };
    
    const dataProducts = processor.process(context);
    
    for (const config of dataProducts) {
        const dpd = buildDpdObject(config, csn, appConfig);
        
        dpdFiles.push({
            filename: `${dpd.name}.dpd.json`,
            content: JSON.stringify(dpd, null, 2)
        });
    }
    
    return dpdFiles;
}

module.exports = {
    generateDpdFiles
};