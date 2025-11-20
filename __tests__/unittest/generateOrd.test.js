const cds = require("@sap/cds");
const path = require("path");
const { generateOrd, _loadAppYaml, _handleIntegrationDependency } = require("../../lib/generateOrd");

jest.mock("../../lib/ord", () => {
    return jest.fn(() => ({
        $schema: "https://open-resource-discovery.github.io/specification/spec-v1/interfaces/Document.schema.json",
        openResourceDiscovery: "1.9",
        packages: [
            {
                ordId: "customer.testapp:package:TestPackage:v1",
            },
        ],
        apiResources: [
            {
                ordId: "customer.testapp:apiResource:TestService:v1",
                partOfPackage: "customer.testapp:package:TestPackage:v1",
            },
        ],
    }));
});

jest.mock("fs", () => ({
    ...jest.requireActual("fs"),
    readFileSync: jest.fn(),
}));

jest.mock("js-yaml", () => ({
    load: jest.fn(),
}));

describe("generateOrd", () => {
    const mockCsn = {
        definitions: {
            TestService: {
                kind: "service",
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("generateOrd function", () => {
        it("should generate ORD document in compile mode", () => {
            const result = generateOrd(mockCsn, { mode: "compile" });

            expect(result).toBeDefined();
            expect(result.$schema).toContain("Document.schema.json");
            expect(result.packages).toBeDefined();
            expect(result.apiResources).toBeDefined();
        });

        it("should generate ORD document in build mode", () => {
            const result = generateOrd(mockCsn, { mode: "build" });

            expect(result).toBeDefined();
            expect(result.$schema).toContain("Document.schema.json");
            expect(result.packages).toBeDefined();
            expect(result.apiResources).toBeDefined();
        });

        it("should default to compile mode when no mode specified", () => {
            const result = generateOrd(mockCsn);

            expect(result).toBeDefined();
            expect(result.$schema).toContain("Document.schema.json");
        });

        it("should not load app.yaml in compile mode by default", () => {
            const fs = require("fs");
            const yaml = require("js-yaml");

            generateOrd(mockCsn, { mode: "compile" });

            expect(fs.readFileSync).not.toHaveBeenCalled();
            expect(yaml.load).not.toHaveBeenCalled();
        });

        it("should attempt to load app.yaml in build mode", () => {
            const fs = require("fs");
            jest.spyOn(cds.utils, "exists").mockReturnValue(false);

            generateOrd(mockCsn, { mode: "build" });

            expect(cds.utils.exists).toHaveBeenCalled();
        });

        it("should include Integration Dependencies when includeIntegrationDependencies is true", () => {
            const fs = require("fs");
            const yaml = require("js-yaml");

            jest.spyOn(cds.utils, "exists").mockReturnValue(true);
            fs.readFileSync.mockReturnValue("mock yaml content");
            yaml.load.mockReturnValue({
                overrides: {
                    commercial: {
                        "application-namespace": "com.sap.test",
                    },
                    dataProducts: {
                        consumption: {
                            "sap.s4:apiResource:PurchaseOrder:v1": {
                                minimumVersion: "1.0.0",
                                mandatory: true,
                                consumptionType: "replication",
                            },
                        },
                    },
                },
            });

            const result = generateOrd(mockCsn, { mode: "compile", includeIntegrationDependencies: true });

            expect(result.integrationDependencies).toBeDefined();
            expect(result.integrationDependencies.length).toBeGreaterThan(0);
        });
    });

    describe("_loadAppYaml", () => {
        it("should return null when app.yaml does not exist", () => {
            jest.spyOn(cds.utils, "exists").mockReturnValue(false);

            const result = _loadAppYaml();

            expect(result).toBeNull();
        });

        it("should load and parse app.yaml when it exists", () => {
            const fs = require("fs");
            const yaml = require("js-yaml");
            const mockYamlContent = {
                overrides: {
                    commercial: {
                        "application-namespace": "com.sap.test",
                    },
                },
            };

            jest.spyOn(cds.utils, "exists").mockReturnValue(true);
            fs.readFileSync.mockReturnValue("mock yaml content");
            yaml.load.mockReturnValue(mockYamlContent);

            const result = _loadAppYaml();

            expect(result).toEqual(mockYamlContent);
            expect(fs.readFileSync).toHaveBeenCalled();
            expect(yaml.load).toHaveBeenCalledWith("mock yaml content");
        });

        it("should return null and log error when app.yaml parsing fails", () => {
            const fs = require("fs");
            const yaml = require("js-yaml");

            jest.spyOn(cds.utils, "exists").mockReturnValue(true);
            fs.readFileSync.mockReturnValue("mock yaml content");
            yaml.load.mockImplementation(() => {
                throw new Error("YAML parse error");
            });

            const result = _loadAppYaml();

            expect(result).toBeNull();
        });
    });

    describe("_handleIntegrationDependency", () => {
        it("should return false when no consumption config exists", () => {
            const ordDocument = {};
            const appFoundationConfig = {
                overrides: {},
            };

            const result = _handleIntegrationDependency(ordDocument, appFoundationConfig);

            expect(result).toBe(false);
            expect(ordDocument.integrationDependencies).toBeUndefined();
        });

        it("should add Integration Dependencies when consumption config exists", () => {
            const ordDocument = {
                packages: [{ ordId: "customer.testapp:package:TestPackage:v1" }],
            };
            const appFoundationConfig = {
                overrides: {
                    commercial: {
                        "application-namespace": "com.sap.test",
                    },
                    dataProducts: {
                        consumption: {
                            "sap.s4:apiResource:PurchaseOrder:v1": {
                                minimumVersion: "1.0.0",
                                mandatory: true,
                                consumptionType: "replication",
                            },
                        },
                    },
                },
            };

            const result = _handleIntegrationDependency(ordDocument, appFoundationConfig);

            expect(result).toBe(true);
            expect(ordDocument.integrationDependencies).toBeDefined();
            expect(ordDocument.integrationDependencies.length).toBeGreaterThan(0);
        });

        it("should handle errors gracefully during Integration Dependency generation", () => {
            const ordDocument = {
                packages: [{ ordId: "customer.testapp:package:TestPackage:v1" }],
            };
            const appFoundationConfig = {
                overrides: {
                    dataProducts: {
                        consumption: {
                            "invalid-ord-id": {
                                minimumVersion: "1.0.0",
                            },
                        },
                    },
                },
            };

            const result = _handleIntegrationDependency(ordDocument, appFoundationConfig);

            expect(result).toBe(false);
        });
    });
});
