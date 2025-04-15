const cds = require("@sap/cds");
const {getAuthConfig} = require("./authentication");

cds.on("bootstrap", async () => {
    getAuthConfig();
});

module.exports = cds.server;