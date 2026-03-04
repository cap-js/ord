const { parentPort } = require("worker_threads");
const compileMetadata = require("../metaData");

parentPort.on("message", ({url, model}) => {
    compileMetadata(url, model).then(result => parentPort.postMessage(result));
});
