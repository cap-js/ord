const cds = require("@sap/cds");

// Routes are registered in cds-plugin.js to handle multiple CDS installations
// This class exists only for service definition compatibility
class OpenResourceDiscoveryService extends cds.ApplicationService {}

module.exports = { OpenResourceDiscoveryService };
