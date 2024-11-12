const cds = require("@sap/cds");
const ord = require("../lib/ord");
const path = require("path");
const csn = require("./__mocks__/publicResourcesCsn.json");

describe("Tests for default ORD document when .cdsrc.json is present", () => {
    beforeAll(async () => { });

    beforeEach(() => {
        cds.root = path.join(__dirname, "bookshop");
        cds.env = {};
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("Successfully create ORD Documents with defaults", () => {
        const document = ord(csn);
        expect(document).not.toBeUndefined();
    });
});
