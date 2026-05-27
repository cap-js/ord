const cds = require("@sap/cds");

// Unified INFO-level logging - simple and consistent across all environments
module.exports = cds.log("ord-plugin", {
    level: cds.log?.levels?.INFO,
});
