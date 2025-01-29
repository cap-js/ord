const cds = require("@sap/cds");

const Logger = cds.log("ord-plugin", {
    level: cds.env?.DEBUG || process.env.DEBUG
        ? cds.log?.levels?.DEBUG
        : cds.log?.levels?.WARN,
});

module.exports = {
    Logger,
};
