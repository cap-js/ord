const { parentPort, workerData } = require("worker_threads");

const compileMetadata = require("../metaData");

parentPort.on("message", ({ url }) => {
    compileMetadata(url, workerData.model) //
        .then(({ response }) => parentPort.postMessage(JSON.stringify(response)));
});
