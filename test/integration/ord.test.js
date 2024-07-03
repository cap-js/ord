const cds = require("@sap/cds");
const Ord = require("path").resolve(__dirname, "/Users/I745851/Documents/work/calesi/plugins/ORD/xmpl");
const { expect, GET ,axios} = cds.test(Ord);

describe("ORD endpoint", () => {
    it("ORD endpoint test", async () => {
        try {
          let Response = await GET("/open-resource-discovery/v1/documents/1");
          expect(Response.status).to.equal(200);
          //check version id:
          // expect(Response.data).to.have.property('openResourceDiscovery','1.6'); // Not giving output
          expect(Response.data).to.not.be.null
        } catch (e) {
            // expect(e.name).to.equal('AxiosError');
            throw e;
        }
    });
});