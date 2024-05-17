const cds = (module.exports = require("@sap/cds/lib"));
const { ord, getMetadata, defaults } = require("./");

cds.app = require("express")();

class ORD {
  get compile() {
    let compile = require("@sap/cds/lib/compile/cds-compile");
    cds.extend(compile.to.constructor).with(
      class {
        get ord() {
          return (super.ord = ord);
        }
      }
    );
    return (super.compile = compile);
  }
}
cds.extend(cds.constructor).with(ORD);

cds.on("bootstrap", (app) => {
  app.use("/.well-known/open-resource-discovery", async (req, res) => {
    if (req.url === "/") {
      res.status(200).send(defaults.baseTemplate);
    } else {
      const { contentType, response } = await getMetadata(req.url);
      res.status(200).contentType(contentType).send(response);
    }
  });

  app.get("/open-resource-discovery/v1/documents/1", async (req, res) => {
    try {
      const linkedCsn = cds.linked(await cds.load(cds.env.folders.srv));
      const data = ord(linkedCsn);
      return res.status(200).send(data);
    } catch (error) {
      console.log(error);
      return res.status(200).send(error);
    }
  });
});

module.exports = cds.server;
