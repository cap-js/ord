const cds = require("@sap/cds");
const path = require("path");
const csn = require("./__mocks__/publicResourcesCsn.json");

describe("Tests for ORD document when .cdsrc.json has no `ord` property", () => {
    let ord;

    beforeAll(() => {
        jest.spyOn(require("../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        ord = require("../lib/ord");
        cds.root = path.join(__dirname, "bookshop");
        cds.env = {};
     });

    afterAll(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });

    test("Successfully create ORD Documents with no `ord` in .cdsrc.json", () => {

        const document = ord(csn);
        expect(document).not.toBeUndefined();
        expect(document).toMatchSnapshot();
    });
});
