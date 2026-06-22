const cds = require("@sap/cds");

if (cds.cli.command === "build") {
    cds.build?.register?.("ord", require("./lib/build"));
}

Object.defineProperty(cds.compile.to, "ord", {
    configurable: true,
    get: () => (model) => require("./lib/index").ord(model, []),
});

cds.on("bootstrap", (app) => {
    const { setHttpRouteOnRootSpan } = require("./lib/telemetry");
    app.use(setHttpRouteOnRootSpan);
});
