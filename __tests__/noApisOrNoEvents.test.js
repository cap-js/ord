const cds = require("@sap/cds");
const csn = require("./__mocks__/noApisOrNoEventsCsn.json");
const path = require("path");

describe("Tests for ORD document when there no events or entities in service definitions", () => {
    let ord;
    beforeAll(() => {
        cds.root = path.join(__dirname, "bookshop");
        cds.env.ord = {
            namespace: "sap.test.cdsrc.sample",
            openResourceDiscovery: "1.10",
            description: "this is my custom description",
            policyLevel: "sap:core:v1"
        };
        jest.spyOn(require("../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        ord = require("../lib/ord");
    });

    afterAll(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });

    test("Successfully create ORD Documents: no Catalog service in apiResource; no Admin service in eventResources", () => {
        const document = ord(csn);

        expect(document).not.toBeUndefined();
        expect(document.apiResources).toHaveLength(1);
        expect(document.eventResources).toHaveLength(1);
        expect(document.apiResources[0].ordId).toEqual(expect.stringContaining("AdminService"));
        expect(document.eventResources[0].ordId).toEqual(expect.stringContaining("CatalogService"));
    });
});
