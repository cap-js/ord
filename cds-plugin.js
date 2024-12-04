
const { Logger } = require('./lib/logger');
const cds = require("@sap/cds");
require('./services/ORDService');
require('./services/wellKnownService');
const path = require("path");
const ORDService = path.resolve(__dirname, "services/ORDService");
const wellKnownService = path.resolve(__dirname, "services/wellKnownService");

// cds.on("bootstrap", async (app) => {
// 	try {
// 		cds.serve("ORDService").from(ORDService).in(app);
//         cds.serve("wellKnownService").from(wellKnownService).in(app);
// 	} catch (error) {
// 		throw new Error(`Error loading ORDService: ${error.message}`);
// 	}
// });

// cds.on("bootstrap", async (app) => {
// 	try {
// 		cds.serve("wellKnownService").from(wellKnownService).in(app);
// 	} catch (error) {
// 		throw new Error(`Error loading wellKnownService: ${error.message}`);
// 	}
// });

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

module.exports = cds.server;

registerORDCompileTarget();
