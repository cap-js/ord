const cds = require("@sap/cds/lib");
const { workerData } = require("piscina");

const Logger = require("../logger");
const compileMetadata = require("../meta-data");

// Worker threads skip cds-plugin.js — re-register compile targets
Object.keys(cds.env.plugins || {})
    .filter(plugin => plugin !== '@cap-js/ord')
    .forEach((plugin) => {
    try {
        require(`${plugin}/lib/api`)?.registerCompileTargets?.();
    } catch (error) {
        Logger.warn(`Failed to register compile targets for ${plugin}: ${error}`);
    }
});

module.exports = ({ url }) => {
    // JSON round-trip: CDS compiler output may contain Generator objects
    // that cannot be transferred via postMessage (structured clone algorithm).
    return compileMetadata(url, workerData.model) //
        .then(({ response }) => JSON.parse(JSON.stringify(response)));
};
