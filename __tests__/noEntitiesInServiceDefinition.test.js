const cds = require("@sap/cds");
const csn = require("./__mocks__/noEntitiesInServiceDefinitionCsn.json");
const path = require("path");

describe("Tests for ORD document when there no events or entities in service definitions", () => {
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

    test("Successfully create ORD Document: no entityTypeMappings field in apiResource", () => {
        const document = ord(csn);

        expect(document).not.toBeUndefined();
        expect(document.apiResources).toHaveLength(1);
        expect(document.eventResources).toHaveLength(1);
        expect(document.apiResources[0].ordId).toEqual(expect.stringContaining("EbMtEmitter"));
        expect(document.eventResources[0].ordId).toEqual(expect.stringContaining("EbMtEmitter"));
        expect(document.apiResources[0].entityTypeMappings).toBeUndefined();
    });
});