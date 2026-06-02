const cds = require("@sap/cds");
const { before, after } = require("node:test");

module.exports = function (path, environment) {
    const env = process.env;

    before(() => {
        process.env = environment;
    });

    after(() => {
        process.env = env;
    });

    return cds.test(path);
};
