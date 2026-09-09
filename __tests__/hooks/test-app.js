const path = require("node:path");
const cds = require("@sap/cds");
const { before, after } = require("node:test");

module.exports = function (appPath, environment) {
    const originalEnv = process.env;

    before(() => {
        const testEnv = { ...environment };
        // Resolve a relative CDS_CONFIG against the app directory rather than the
        // current working directory. cds.env may be evaluated by a plugin (e.g.
        // @sap/cds-mtxs) before cds.root is set, in which case a relative path
        // would resolve against the repo root and throw ENOENT. See #546.
        if (testEnv.CDS_CONFIG && !path.isAbsolute(testEnv.CDS_CONFIG)) {
            testEnv.CDS_CONFIG = path.join(appPath, testEnv.CDS_CONFIG);
        }
        process.env = testEnv;
    });

    after(() => {
        process.env = originalEnv;
    });

    return cds.test(appPath);
};
