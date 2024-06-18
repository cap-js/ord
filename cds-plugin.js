require("./lib/plugin");
const cds = require("@sap/cds");

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
