const cds = require("@sap/cds");
const cds_dk = require("@sap/cds-dk");
const path = require("path");
const { generateDpdFiles, isDpdGenerationEnabled } = require("./dataProducts/dpd");
const { Logger } = require("./logger");

module.exports = class DpdBuildPlugin extends cds_dk.build.Plugin {
    static taskDefaults = { src: cds.env.folders.srv };
    
    init() {
        // Configure output directory
        this.task.dest = path.join(cds.root, "gen/dpd");
    }
    
    async build() {
        Logger.info("Starting DPD generation...");
        
        // Check if DPD generation is enabled
        if (!isDpdGenerationEnabled()) {
            Logger.info("DPD generation is disabled. Enable it by setting cds.dpd.dataProducts.enabled=true in .cdsrc.json");
            return [];
        }
        
        // Load the model
        const model = await this.model();
        
        // TODO: Initialize app configuration
        // TODO: Call generateDpdFiles
        
        return [];
    }
};