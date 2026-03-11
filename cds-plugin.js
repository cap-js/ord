const cds = require("@sap/cds");

if (cds.cli.command === "build") {
    cds.build?.register?.("ord", require("./lib/build/ord-plugin"));
}

const registerORDCompileTarget = () => {
    Object.defineProperty(cds.compile.to, "ord", {
        configurable: true,
        get: () => {
            const ord = require("./lib/index").ord;
            Object.defineProperty(this, "ord", { ord });
            return ord;
        },
    });
};

registerORDCompileTarget();
