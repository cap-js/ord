const { workerData } = require("piscina");

const compileMetadata = require("../../core/compile-metadata");

module.exports = ({ url }) => {
    // JSON round-trip: CDS compiler output may contain Generator objects
    // that cannot be transferred via postMessage (structured clone algorithm).
    return compileMetadata(url, workerData.model) //
        .then(({ response }) => JSON.parse(JSON.stringify(response)));
};
