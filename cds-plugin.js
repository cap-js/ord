require("./lib/plugin");
const cds = require("@sap/cds");

function _lazyRegisterCompileTarget() {
  const value = require("./lib/index").ord;
  Object.defineProperty(this, "ord", { value });
  return value;
}

const registerORDCompileTarget = () => {
  Object.defineProperty(cds.compile.to, "ord", {
    get: _lazyRegisterCompileTarget,
    configurable: true,
  });
};

registerORDCompileTarget();

cds.build?.register?.('ord', require('./lib/build'));  