const cds = require("@sap/cds");
const internal_csn = require("./__mocks__/internalResourcesCsn.json");
const ord = require("../lib/ord");
const path = require("path");
const private_csn = require("./__mocks__/privateResourcesCsn.json");

describe("Tests for ORD document when there is no public service", () => {
    beforeAll(() => {
        cds.root = path.join(__dirname, "bookshop");
        cds.env = {};
    });

    afterAll(() => {
        jest.clearAllMocks();
    })

    test("All services are private: Successfully create ORD Documents without packages, empty apiResources and eventResources lists", () => {
        const document = ord(private_csn);

        expect(document.packages).not.toBeDefined();
        expect(document.apiResources).toHaveLength(0);
        expect(document.eventResources).toHaveLength(0);
    });

    test("All services are internal: Successfully create ORD Documents without packages, empty apiResources and eventResources lists", () => {
        const document = ord(internal_csn);

        expect(document.packages).not.toBeDefined();
        expect(document.apiResources).toHaveLength(0);
        expect(document.eventResources).toHaveLength(0);
    });
});
