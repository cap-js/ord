const cds = require("@sap/cds");
const cds_dk = require("@sap/cds-dk");
const path = require("path");
const { Logger } = require("./logger");

module.exports = class DpdBuildPlugin extends cds_dk.build.Plugin {
    static taskDefaults = { src: cds.env.folders.srv };
    
    init() {
        // Configure output directory
        this.task.dest = path.join(cds.root, "gen/dpd");
    }
    
    async build() {
        Logger.info("Starting DPD generation...");
        
        if (!cds.env.dpd?.dataProducts?.enabled) {
            Logger.info("DPD generation is disabled");
            return [];
        }
        
        // Load the model
        const model = await this.model();
        
        // TODO: Generate DPD files
        
        return [];
    }
};