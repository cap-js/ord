const cds = require("@sap/cds");
const ord = require("../lib/ord");
const path = require("path");
const csn = require("./__mocks__/publicResourcesCsn.json");

jest.mock("../lib/date", () => ({
    getRFC3339Date: jest.fn(() => "2024-11-04T14:33:25+01:00")
}));

describe("Tests for ORD document when .cdsrc.json has no `ord` property", () => {
    beforeAll(() => {
        cds.root = path.join(__dirname, "bookshop");
        cds.env = {};
     });

    afterAll(() => {
        jest.clearAllMocks();
    });

    test("Successfully create ORD Documents with no `ord` in .cdsrc.json", () => {

        const document = ord(csn);
        expect(document).not.toBeUndefined();
        expect(document).toMatchSnapshot();
    });
});
