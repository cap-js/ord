const cds = require("@sap/cds");
const { getAuthConfig } = require("./lib/authentication");
const { Logger } = require("./lib/index.js");

console.log('=== ORD Plugin Loading ===');
console.log(`CDS CLI command: ${cds.cli.command}`);
console.log(`Node.js version: ${process.version}`);
console.log(`Working directory: ${process.cwd()}`);

try {
    const cdsPackage = require('@sap/cds/package.json');  
    console.log(`CDS runtime version: ${cdsPackage.version}`);
} catch (err) {
    console.log(`Could not read CDS version: ${err.message}`);
}

if (cds.cli.command === "build") {
    console.log('Registering ORD build target');
    cds.build?.register?.("ord", require("./lib/build"));
}

// load auth config before any service is started
cds.on("bootstrap", async () => {
    console.log('=== ORD Plugin Bootstrap Event ===');
    console.log(`cds.app exists in bootstrap: ${!!cds.app}`);
    console.log(`cds.app type in bootstrap: ${typeof cds.app}`);
    
    if (cds.app) {
        console.log(`cds.app constructor: ${cds.app.constructor.name}`);
    }
    
    try {
        getAuthConfig();
        console.log('Auth config loaded successfully');
    } catch (err) {
        console.error(`Error loading auth config: ${err.message}`);
    }
});

// Add served event logging
cds.on("served", () => {
    console.log('=== ORD Plugin Served Event ===');
    console.log(`cds.app exists in served: ${!!cds.app}`);
    console.log(`cds.app type in served: ${typeof cds.app}`);
    
    if (cds.app) {
        console.log(`cds.app constructor: ${cds.app.constructor.name}`);
        console.log('Express app is now available for route registration');
    }
});

// Add listening event logging  
cds.on("listening", () => {
    console.log('=== ORD Plugin Listening Event ===');
    console.log('CAP application is now listening for requests');
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
