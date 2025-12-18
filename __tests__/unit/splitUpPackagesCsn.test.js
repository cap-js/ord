// Mock the Logger module
jest.mock("../../lib/logger", () => ({
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
}));

const cds = require("@sap/cds");
const path = require("path");
const { ORD_ACCESS_STRATEGY } = require("../../lib/constants");
const bahCsn = require("../__mocks__/splitUpPackagesCsn.json");

describe("ORD Generation for Business Accelerator Hub", () => {
    let ord;

    beforeAll(async () => {
        cds.root = path.join(__dirname, "../bookshop");

        // Initialize authentication configuration for tests
        const authentication = require("../../lib/auth/authentication");

        // Mock the createAuthConfig to return a default open configuration
        jest.spyOn(authentication, "createAuthConfig").mockReturnValue({
            accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
        });

        jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        // Mock MCP plugin availability to false for these tests
        jest.spyOn(require("../../lib/mcpAdapter"), "isMCPPluginAvailable").mockReturnValue(false);
        // Require ord module after mocks are set up
        ord = require("../../lib/ord");
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
