const cds = require("@sap/cds");
const { registerIntegrationDependencyProvider } = require("./lib/extensionRegistry");

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

/**
 * Extension API for external plugins.
 *
 * Allows plugins like @cap-js/event-broker to register providers
 * for Integration Dependency data at runtime.
 *
 * @example
 * const ord = require("@cap-js/ord");
 * ord.registerIntegrationDependencyProvider(() => ({
 *     namespace: "sap.s4",
 *     events: ["sap.s4.beh.salesorder.v1.SalesOrder.Changed.v1"]
 * }));
 */
module.exports = {
    registerIntegrationDependencyProvider,
};
