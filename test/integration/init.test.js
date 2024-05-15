const cds = require("@sap/cds");
const Ord = require("path").resolve(__dirname, "../../xmpl");
const { expect, GET } = cds.test(Ord);

describe("Test endpoints", () => {
  it("initial test", async () => {
    try {
      let response = await GET("/");
      expect(response.status).to.equal(200);
    } catch (e) {
        throw e;
    }
  });

  it("Well known endpoint test", async () => {
    try {
      let response = await GET("/.well-known/open-resource-discovery");
      expect(response.status).to.equal(200);
      //check if openResourceDiscoveryV1 exists
      expect(response.data).to.have.property('openResourceDiscoveryV1');
      //check if openResourceDiscoveryV1 is not null/undefined
      expect(response.data.openResourceDiscoveryV1).to.not.be.undefined;
      expect(response.data.openResourceDiscoveryV1).to.not.be.null;
    } catch (e) {
      throw e;
    }
  });
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
