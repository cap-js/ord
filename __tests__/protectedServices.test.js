const cds = require("@sap/cds");
const internal_csn = require("./__mocks__/internalResourcesCsn.json");
const ord = require("../lib/ord");
const path = require("path");
const private_csn = require("./__mocks__/privateResourcesCsn.json");

function checkOrdDocument(csn) {
    const document = ord(csn);

    expect(document).not.toBeUndefined();
    expect(document.packages).not.toBeDefined();
    expect(document.apiResources).toHaveLength(0);
    expect(document.eventResources).toHaveLength(0);
}


jest.mock("../lib/date", () => ({
    getRFC3339Date: jest.fn(() => "2024-11-04T14:33:25+01:00")
}));

describe("Tests for ORD document when there is no public service", () => {
    beforeAll(() => {
        cds.root = path.join(__dirname, "bookshop");
        cds.env.ord = {
            namespace: "sap.test.cdsrc.sample",
            openResourceDiscovery: "1.10",
            description: "this is my custom description",
            policyLevel: "sap:core:v1"
        };
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    test("All services are private: Successfully create ORD Documents without packages, empty apiResources and eventResources lists", () => {
        checkOrdDocument(private_csn);
    });

    test("All services are internal: Successfully create ORD Documents without packages, empty apiResources and eventResources lists", () => {
        checkOrdDocument(internal_csn);
    });
});
