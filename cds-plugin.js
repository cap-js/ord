const cds = require("@sap/cds");
const { getAuthConfig } = require("./lib/authentication");

if (cds.cli.command === "build") {
    cds.build?.register?.('ord', require("./lib/build"));
}

// load auth config before any service is started
cds.on("bootstrap", async () => {
    getAuthConfig();
});

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

