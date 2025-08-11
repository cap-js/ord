const cds = require("@sap/cds");
const cds_dk = require("@sap/cds-dk");

module.exports = class DpdBuildPlugin extends cds_dk.build.Plugin {
    static taskDefaults = { src: cds.env.folders.srv };
    
    async build() {
        if (!cds.env.dpd?.dataProducts?.enabled) {
            console.log("DPD generation is disabled");
            return [];
        }
        
        console.log("Starting DPD generation...");
        return [];
    }
};