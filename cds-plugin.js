const cds = require("@sap/cds");
const { getAuthConfig } = require("./lib/authentication");

if (cds.cli.command === "build") {
    cds.build?.register?.("ord", require("./lib/build"));
}

// load auth config before any service is started
cds.on("bootstrap", async () => {
    getAuthConfig();
});

// Lazy-load the compile target to avoid loading generateOrd module at startup
Object.defineProperty(cds.compile.to, "ord", {
    get() {
        const { generateOrd } = require("./lib/generateOrd");
        const ordFunction = (csn) => generateOrd(csn, { mode: "compile" });
        // Replace the getter with the actual function for subsequent access
        Object.defineProperty(cds.compile.to, "ord", {
            value: ordFunction,
            configurable: true,
            writable: true,
        });
        return ordFunction;
    },
    configurable: true,
});
