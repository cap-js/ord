const cds = require("@sap/cds");
const path = require("path");

describe("ord", () => {
    let ord;

    beforeAll(() => {
        cds.root = path.join(__dirname, "../bookshop");
        jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        jest.spyOn(require("../../lib/mcpAdapter"), "isMCPPluginAvailable").mockReturnValue(false);
    });

    beforeEach(() => {
        jest.resetModules();
        cds.env.ord = {
            namespace: "sap.test.cdsrc.sample",
        };
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe("Authentication error handling", () => {
        it("should throw error when authentication configuration has errors (fail-closed)", () => {
            // Mock createAuthConfig to return an error
            const authentication = require("../../lib/auth/authentication");
            jest.spyOn(authentication, "createAuthConfig").mockReturnValue({
                types: ["open"],
                accessStrategies: [{ type: "open" }],
                error: "Invalid bcrypt hash provided",
            });

            ord = require("../../lib/ord");
            const csn = require("../__mocks__/publicResourcesCsn.json");

            expect(() => ord(csn)).toThrow("Authentication configuration error: Invalid bcrypt hash provided");
        });

        it("should succeed when authentication configuration has no errors", () => {
            // Mock createAuthConfig to return valid config without error
            const authentication = require("../../lib/auth/authentication");
            jest.spyOn(authentication, "createAuthConfig").mockReturnValue({
                types: ["open"],
                accessStrategies: [{ type: "open" }],
            });

            ord = require("../../lib/ord");
            const csn = require("../__mocks__/publicResourcesCsn.json");

            expect(() => ord(csn)).not.toThrow();
            const document = ord(csn);
            expect(document).toBeDefined();
            expect(document.apiResources).toBeDefined();
        });
    });
});
