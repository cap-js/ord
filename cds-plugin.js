const cds = require("@sap/cds");

if (cds.cli.command === "build") {
    cds.build?.register?.("ord", require("./lib/build"));
}

Object.defineProperty(cds.compile.to, "ord", {
    configurable: true,
    get: () => (model) => require("./lib/index").ord(model, []),
});

// Attach the OTel telemetry middleware once express is up, without touching
// any of the business handlers. See lib/telemetry.js for the rationale.
cds.on("bootstrap", (app) => {
    const { ordTelemetryMiddleware } = require("./lib/telemetry");
    app.use(ordTelemetryMiddleware);
});
