const cds = require("@sap/cds");

// Unified INFO-level logging - simple and consistent across all environments
const Logger = cds.log("ord-plugin", {
    level: cds.log?.levels?.INFO,
});

module.exports = {
    Logger,
};
