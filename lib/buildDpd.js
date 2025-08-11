const cds = require("@sap/cds");
const cds_dk = require("@sap/cds-dk");

module.exports = class DpdBuildPlugin extends cds_dk.build.Plugin {
    static taskDefaults = { src: cds.env.folders.srv };
    
    async build() {
        console.log("DPD build called");
        return [];
    }
};