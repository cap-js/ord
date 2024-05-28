const cds = (module.exports = require("@sap/cds/lib"));
const { ord, getMetadata, defaults } = require("./");

cds.app = require("express")();

cds.on("bootstrap", (app) => {
  app.use("/.well-known/open-resource-discovery", async (req, res) => {
    if (req.url === "/") {
      res.status(200).send(defaults.baseTemplate);
    } else {
      try {
        const { contentType, response } = await getMetadata(req.url);
        res.status(200).contentType(contentType).send(response);
      } catch (error) {
        console.log(error);
        console.log('Error while generating metadata');
        res.status(500).send(error.message);
      }
    }
  });

  app.get("/open-resource-discovery/v1/documents/1", async (req, res) => {
    try {
      const csn = await cds.load(cds.env.folders.srv);
      const data = ord(csn);
      return res.status(200).send(data);
    } catch (error) {
      console.log(error);
      console.log('Error while creating ORD document');
      return res.status(500).send(error.message);
    }
  });
});

module.exports = cds.server;
