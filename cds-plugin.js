const cds = require("@sap/cds");
const { getCustomORDContent } = require("./lib/extend-ord-with-custom");

if (cds.cli.command === "build") {
    cds.build?.register?.("ord", require("./lib/build"));
}

Object.defineProperty(cds.compile.to, "ord", {
    configurable: true,
    get: () => (model) =>
        require("./lib/index").ord(model, [getCustomORDContent(cds?.env?.["ord"]?.customOrdContentFile)]),
});
