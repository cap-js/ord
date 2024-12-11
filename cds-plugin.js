
const { Logger } = require('./lib/logger');
const cds = require("@sap/cds");
const path = require("path");
const OrdService = path.resolve(__dirname, 'services/');
const WellKnownService = path.resolve(__dirname, 'services/');

cds.on("bootstrap", async (app) => {
	try {
		cds.serve("OrdService").from(OrdService).in(app);
        cds.serve("WellKnownService").from(WellKnownService).in(app);

	} catch (error) {
		throw new Error(`Error ORDService Endpoints: ${error.message}`);
	}
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

module.exports = cds.server;

registerORDCompileTarget();
