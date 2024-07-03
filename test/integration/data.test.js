const cds = require("@sap/cds");
const Ord = require("path").resolve(__dirname, "/Users/I745851/Documents/work/calesi/plugins/ORD/xmpl");
const { expect, GET ,axios} = cds.test(Ord);
const fs = require('fs');

// check openApi endpoint :
describe("OpenApi", () => {
    it("Endpoint- ORD", async() => {
      try {
      let Response = await GET(".well-known/open-resource-discovery/v1/api-metadata/ProcessorService.oas3.json ");
      expect(Response.status).to.equal(200);
      console.log(Response);
      expect(Response.data).to.have.property('openapi','3.0.2');
      expect(Response.data).to.not.be.undefined;
      }
      catch(e)
      {
        throw e;
      }
    })
  })

  // cdsrc test:
// describe("CDSRC namespace test")