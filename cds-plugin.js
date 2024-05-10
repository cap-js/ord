console.log("\n\n ORD working !!! \n\n");
const cds = require('@sap/cds/lib');
const { ord, getMetaData, defaults } = require('./lib');

cds.app = require("express")();

cds.on("bootstrap", (app) => {
    app.use("/.well-known/open-resource-discovery", async (req, res) => {
        if (req.url === "/") {
            res.status(200).send(defaults.baseTemplate);
        } else {
            const { contentType, response } = await getMetaData(req.url);
            res.status(200).contentType(contentType).send(response);
        }
    });

    app.get("/open-resource-discovery/v1/documents/1", async (req, res) => {
        try {
            const data = ord();
            return res.status(200).send(data);
        } catch (error) {
            console.log(error);
            return res.status(200).send(error);
        }
    });
});

module.exports = cds.server;
