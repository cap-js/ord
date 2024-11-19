const cds = require("@sap/cds");
const csnInternal = require("./__mocks__/internalResourcesCsn.json");
const csnPrivate = require("./__mocks__/privateResourcesCsn.json");
const path = require("path");

let ord;
function checkOrdDocument(csn) {
    const document = ord(csn);

    expect(document).not.toBeUndefined();
    expect(document.packages).not.toBeDefined();
    expect(document.apiResources).toHaveLength(0);
    expect(document.eventResources).toHaveLength(0);
}

describe("Tests for ORD document when there is no public service", () => {
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

    test("All services are private: Successfully create ORD Documents without packages, empty apiResources and eventResources lists", () => {
        checkOrdDocument(csnPrivate);
    });

    test("All services are internal: Successfully create ORD Documents without packages, empty apiResources and eventResources lists", () => {
        checkOrdDocument(csnInternal);
    });
});
