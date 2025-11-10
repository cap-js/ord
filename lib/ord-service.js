const cds = require("@sap/cds");

class OpenResourceDiscoveryService extends cds.ApplicationService {
    async init() {
        // Routes are now registered in cds-plugin.js during bootstrap
        // This service class is kept for service discovery and CDS integration
        return super.init();
    }
}

module.exports = { OpenResourceDiscoveryService };
