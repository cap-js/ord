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
        
        // Load the model
        const model = await this.model();
        
        // Find services with data product annotations
        let count = 0;
        for (const [name, def] of Object.entries(model.definitions)) {
            if (def.kind === 'service' && def['@ORD.dataProduct']) {
                console.log(`Found data product: ${name}`);
                count++;
            }
        }
        
        console.log(`Found ${count} data products`);
        return [];
    }
};