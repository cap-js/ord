console.log("\n\n ORD working !!! \n\n");
const cds_dk = require("@sap/cds-dk");
const cds = require('@sap/cds/lib');
const { ord, getMetaData, defaults } = require('./lib');

cds_dk.app = require("express")();

class ORD {
    get compile() {
      let compile = require('@sap/cds/lib/compile/cds-compile')
      cds.extend (compile.to.constructor) .with (class {
        get ord() {
            return super.ord = ord 
        }
      })
      return super.compile = compile
    }
}
cds.extend (cds.constructor).with(ORD);

cds_dk.on("bootstrap", (app) => {
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
            const csn = await cds.load(cds.env.folders.srv)
            const data = ord(csn); 
            return res.status(200).send(data);
        } catch (error) {
            console.log(error);
            return res.status(200).send(error);
        }
    });
});

module.exports = cds_dk.server;
