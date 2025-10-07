const { interopCSN } = require("../../lib/interop-csn.js");

jest.mock("@sap/cds/lib/i18n/localize", () => ({
    bundles4: jest.fn()
}));

const localize = require("@sap/cds/lib/i18n/localize");

describe("interop-csn", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should transform CSN with i18n and annotations", () => {
        localize.bundles4.mockReturnValue([
            ["en", { "service.title": "My Service", "unused.key": "Unused" }]
        ]);
        const csn = {
            definitions: {
                "com.example.MyService": {
                    kind: "service",
                    "@title": "{i18n>service.title}",
                    "@cds.autoexpose": true
                }
            }
        };
        expect(interopCSN(csn)).toMatchSnapshot();
    });

    it("should handle annotation mapping", () => {
        localize.bundles4.mockReturnValue([]);
        const csn = {
            definitions: {
                "TestEntity": {
                    kind: "entity",
                    "@Common.Label": "Entity Label",
                    "@description": "Description",
                    "@cds.autoexpose": true,
                    elements: {
                        field1: {
                            "@title": "Field Title",
                            "@label": "Field Label"
                        }
                    }
                }
            }
        };
        expect(interopCSN(csn)).toMatchSnapshot();
    });

    it("should extract service metadata", () => {
        localize.bundles4.mockReturnValue([]);
        const csn = {
            definitions: {
                "customer.namespace.MyService.v2": { kind: "service" }
            }
        };
        expect(interopCSN(csn)).toMatchSnapshot();
    });

    it("should filter unused i18n texts", () => {
        localize.bundles4.mockReturnValue([
            ["en", { "used.key": "Used", "unused.key": "Unused" }],
            ["de", { "unused.key": "Unbenutzt" }]
        ]);
        const csn = {
            definitions: {
                "TestService": {
                    kind: "service",
                    "@title": "{i18n>used.key}"
                }
            }
        };
        expect(interopCSN(csn)).toMatchSnapshot();
    });

    it("should handle empty definitions", () => {
        localize.bundles4.mockReturnValue([]);
        const csn = { definitions: {} };
        expect(interopCSN(csn)).toMatchSnapshot();
    });
});
