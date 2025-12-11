const cds = require("@sap/cds");
const path = require("path");
const { AUTHENTICATION_TYPE, ORD_ACCESS_STRATEGY } = require("../../lib/constants");
const ord = require("../../lib/ord");
const bahCsn = require("../__mocks__/splitUpPackagesCsn.json");

describe("ORD Generation for Business Accelerator Hub", () => {
    beforeAll(async () => {
        cds.root = path.join(__dirname, "../bookshop");

        // Initialize authentication configuration for tests
        const authentication = require("../../lib/auth/authentication");

        // Mock the createAuthConfig to return a default open configuration
        jest.spyOn(authentication, "createAuthConfig").mockResolvedValue({
            types: [AUTHENTICATION_TYPE.Open],
            accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
        });

        // Initialize the auth config
        await authentication.getAuthConfig();

        jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
    });

    beforeEach(() => {
        cds.env.ord = {
            namespace: "sap.test.cdsrc.sample",
            openResourceDiscovery: "1.10",
            description: "Business Accelerator Hub ORD Test",
            policyLevel: "sap:core:v1", //old value, check for compatibility
        };
    });

    afterAll(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });

    describe("Tests for ORD document for Business Accelerator Hub", () => {
        test("Successfully create ORD Documents for Business Accelerator Hub", () => {
            const document = ord(bahCsn);
            expect(document).not.toBeUndefined();
            document.apiResources.forEach((api) => delete api.lastUpdate);
            document.eventResources.forEach((event) => delete event.lastUpdate);
            document.consumptionBundles.forEach((con) => delete con.lastUpdate);
            expect(document).toMatchSnapshot();
            expect(document.openResourceDiscovery).toBe("1.10");
            expect(document.policyLevels).toEqual(["sap:core:v1"]);
            expect(document.description).toBe("Business Accelerator Hub ORD Test");
            expect(document.apiResources).toHaveLength(7);
            expect(document.eventResources).toHaveLength(1);
        });
    });
});
