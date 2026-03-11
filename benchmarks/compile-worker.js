/**
 * Worker thread entry point for parallel CDS compilation.
 *
 * Receives the CDS model once via workerData (serialized at worker creation).
 * Each task message contains only a URL string, keeping per-task overhead minimal.
 */
const { parentPort, workerData } = require("worker_threads");
const { compile: openapi } = require("@cap-js/openapi");
const { compile: asyncapi } = require("@cap-js/asyncapi");
const cdsc = require("@sap/cds-compiler/lib/main");
const cds = require("@sap/cds");

const { model, burnMs } = workerData;

/**
 * Simulate heavier compilation by spinning the CPU.
 * Only used in benchmark mode (burnMs > 0) to replicate enterprise-scale compile times.
 */
function cpuBurn(ms) {
    if (!ms) return;
    const end = performance.now() + ms;
    while (performance.now() < end) {
        Math.random();
    }
}

parentPort.on("message", ({ url }) => {
    try {
        const parts = url
            .split("/")
            .pop()
            .replace(/\.json$/, "")
            .split(".");
        const type = parts.pop();
        const service = parts.join(".");
        const opts = { service, messages: [] };
        let response;

        switch (type) {
            case "oas3":
                response = openapi(model, opts);
                break;
            case "asyncapi2":
                response = asyncapi(model, opts);
                break;
            case "csn":
                response = cdsc.for.effective(model, {
                    beta: { effectiveCsn: true },
                    effectiveServiceName: service,
                });
                break;
            case "edmx":
                response = cds.compile(model).to.edmx(opts);
                break;
            case "graphql": {
                const { generateSchema4 } = require("@cap-js/graphql/lib/schema");
                const { lexicographicSortSchema, printSchema } = require("graphql");
                const linked = cds.linked(model);
                const srv = new cds.ApplicationService(service, linked);
                let schema = generateSchema4({ [service]: srv });
                schema = lexicographicSortSchema(schema);
                response = printSchema(schema);
                break;
            }
        }

        cpuBurn(burnMs);

        // JSON roundtrip required: CDS compiler output may contain Generator objects
        // that cannot be transferred via postMessage (structured clone algorithm).
        parentPort.postMessage({ response: JSON.parse(JSON.stringify(response)) });
    } catch (e) {
        parentPort.postMessage({ error: e.message });
    }
});
