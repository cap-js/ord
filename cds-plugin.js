const cds = require("@sap/cds");

if (cds.cli.command === "build") {
    cds.build?.register?.("ord", require("./lib/build"));
}

function _lazyRegisterCompileTarget() {
    const ord = require("./lib/index").ord;
    Object.defineProperty(this, "ord", { ord });
    return ord;
}

const registerORDCompileTarget = () => {
    Object.defineProperty(cds.compile.to, "ord", {
        get: _lazyRegisterCompileTarget,
        configurable: true,
    });
};

registerORDCompileTarget();
