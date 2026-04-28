const { workerData } = require("piscina");

const compileMetadata = require("../meta-data");
const registerCompileTargets = require("../common/register-compile-targets");

registerCompileTargets(); // Worker threads skip cds-plugin.js — re-register compile targets

module.exports = ({ url }) => {
    // JSON round-trip: CDS compiler output may contain Generator objects
    // that cannot be transferred via postMessage (structured clone algorithm).
    return compileMetadata(url, workerData.model) //
        .then(({ response }) => JSON.parse(JSON.stringify(response)));
};
