const cds = require("@sap/cds");
const csn = require("./__mocks__/localAndNonODMReferencedEntities.json");
const path = require("path");

describe("Tests for ORD document checking if entityTypes and entityTypeMappings are generated correctly", () => {
    let ord;
    beforeAll(() => {
        jest.spyOn(require("../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        ord = require("../lib/ord");
        cds.root = path.join(__dirname, "bookshop");
        cds.env = {
            "ord": {
                "namespace": "sap.sm",
                "openResourceDiscovery": "1.9",
                "description": "this is my custom description",
                "policyLevel": "sap:core:v1"
            }
        };
    });

    afterAll(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });

    test("Successfully create ORD Document: entityTypes with local entities and entityTypeMappings containing referenced entities", () => {
        const document = ord(csn);

        // ...(appConfig.entityTypeMappings?.length > 0 && { entityTypeMappings: [{ entityTypeTargets: appConfig.entityTypeTargets.map(m => m.ordId) }] }),

        expect(document).not.toBeUndefined();
        expect(document.entityTypes).toHaveLength(1);
        expect(document.entityTypes[0].partOfPackage).toEqual(expect.stringContaining("entityType"));
        expect(document.entityTypes[0].level).toEqual(expect.stringContaining("root-entity"));
        expect(document.apiResources[0].entityTypeMappings[0].entityTypeTargets).toEqual(expect.arrayContaining([
            "sap.odm:entityType:SomeODMEntity:v1",
            "sap.sm:entityType:SomeAribaDummyEntity:v1"
        ]));
    });
});