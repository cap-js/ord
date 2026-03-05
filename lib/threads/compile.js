const { parentPort, workerData } = require("worker_threads");
const compileMetadata = require("../metaData");

const { model } = workerData;

parentPort.on("message", ({ url }) => {
    compileMetadata(url, model)
        .then((result) => {
            // JSON roundtrip: CDS compiler output may contain Generator objects
            // that cannot be transferred via postMessage (structured clone algorithm).
            parentPort.postMessage({ response: JSON.parse(JSON.stringify(result.response)) });
        })
        .catch((e) => {
            parentPort.postMessage({ error: e.message });
        });
});
