const cds = require("@sap/cds");
const path = require("path");
const { extendCustomORDContentIfExists } = require("../../lib/extendOrdWithCustom");

describe("extendOrdWithCustom", () => {
    let appConfig = {};
    let warningSpy;

    beforeAll(() => {
        cds.env = {};
        warningSpy = jest.spyOn(console, "warn");
    });

    beforeEach(() => {
        appConfig = {
            env: {
                customOrdContentFile: "customOrdContentFile.json",
            },
        };
    });

    afterAll(() => {
        jest.resetAllMocks();
        jest.clearAllMocks();
    });

    describe("extendCustomORDContentIfExists", () => {
        it("should skip if there is no customOrdContentFile property in the .cdsrc.json", () => {
            const ordContent = {};
            appConfig.env.customOrdContentFile = undefined;
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toEqual(ordContent);
        });

        it("should skip if customOrdContentFile property in the .cdsrc.json points to NON-EXISTING custom ord file", () => {
            const ordContent = {};
            appConfig.env.customOrdContentFile = "./ord/NotExistingCustom.ord.json";
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toEqual(ordContent);
        });

        it("should ignore and log warn if found ord top-level primitive property in customOrdFile", () => {
            const ordContent = {};
            prepareTestEnvironment({ namespace: "sap.sample" }, appConfig, "testCustomORDContentFileThrowErrors.json");
            const result = extendCustomORDContentIfExists(appConfig, ordContent);

            expect(warningSpy).toHaveBeenCalledTimes(3);
            expect(warningSpy).toHaveBeenCalledWith(
                "[ord-plugin] -",
                expect.stringContaining("Found ord top level primitive ord property in customOrdFile:"),
                expect.anything(),
                expect.stringContaining("Please define it in .cdsrc.json."),
            );
            expect(result).toMatchSnapshot();
        });

        it("should add new ord resources that are not supported by cap framework", () => {
            const ordContent = {};
            prepareTestEnvironment({}, appConfig, "testCustomORDContentFileWithNewResources.json");
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toMatchSnapshot();
        });

        it("should enhance the list of generated ord resources", () => {
            const ordContent = {
                packages: [
                    {
                        ordId: "sap.sm:package:smDataProducts:v1",
                        localId: "smDataProductsV1",
                    },
                ],
            };
            prepareTestEnvironment({}, appConfig, "testCustomORDContentFileWithEnhanced.json");
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toMatchSnapshot();
        });

        it("should should patch the existing generated ord resources", () => {
            const ordContent = {
                packages: [
                    {
                        ordId: "sap.sm:package:smDataProducts:v1",
                        localId: "smDataProductsV1",
                    },
                ],
                apiResources: [
                    {
                        ordId: "sap.sm:apiResource:SupplierService:v1",
                        title: "should be removed",
                        partOfGroups: ["sap.cds:service:sap.test.cdsrc.sample:originalService"],
                        partOfPackage: "sap.sm:package:smDataProducts:v2",
                        extensible: {
                            supported: "no",
                        },
                        entityTypeMappings: [
                            {
                                entityTypeTargets: [
                                    {
                                        ordId: "sap.odm:entityType:BusinessPartner:v2",
                                    },
                                    {
                                        ordId: "sap.odm:entityType:BusinessPartner:v3",
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        ordId: "sap.sm:apiResource:orginalService:v2",
                        partOfGroups: ["sap.cds:service:sap.test.cdsrc.sample:originalService"],
                        partOfPackage: "sap.sm:package:smDataProducts:v2",
                        entityTypeMappings: [
                            {
                                entityTypeTargets: [],
                            },
                        ],
                    },
                ],
            };
            prepareTestEnvironment({}, appConfig, "testCustomORDContentFileWithPatch.json");
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toMatchSnapshot();
        });

        it("should patch MCP API resources via custom.ord.json", () => {
            const ordContent = {
                apiResources: [
                    {
                        ordId: "customer.test:apiResource:mcp-server:v1",
                        title: "MCP Server for test-app",
                        shortDescription: "This is the MCP server to interact with the test-app",
                        version: "1.0.0",
                        visibility: "public",
                        releaseStatus: "active",
                        entryPoints: [],
                        apiProtocol: "mcp",
                    },
                ],
            };
            prepareTestEnvironment({}, appConfig, "testCustomORDContentFileWithMCPOverride.json");
            const result = extendCustomORDContentIfExists(appConfig, ordContent);

            expect(result.apiResources).toHaveLength(1);
            const mcpResource = result.apiResources[0];
            expect(mcpResource.ordId).toBe("customer.test:apiResource:mcp-server:v1");
            expect(mcpResource.visibility).toBe("internal");
            expect(mcpResource.title).toBe("Internal MCP Server for CAP Project");
            expect(mcpResource.shortDescription).toBe("Custom MCP server description");
            expect(mcpResource.version).toBe("2.1.0");
            expect(mcpResource.entryPoints).toEqual(["/mcp-server"]);
            expect(mcpResource.releaseStatus).toBe("beta");
            expect(mcpResource.apiProtocol).toBe("mcp"); // Should remain unchanged
        });

        it("should patch IntegrationDependency via custom.ord.json", () => {
            const ordContent = {
                integrationDependencies: [
                    {
                        ordId: "customer.testapp:integrationDependency:externalDependencies:v1",
                        title: "External Dependencies",
                        version: "1.0.0",
                        releaseStatus: "active",
                        visibility: "public",
                        mandatory: false,
                        partOfPackage: "customer.testapp:package:testapp-integrationDependency:v1",
                        aspects: [
                            {
                                title: "sap.sai.Supplier.v1",
                                mandatory: false,
                                apiResources: [{ ordId: "sap.sai:apiResource:Supplier:v1", minVersion: "1.0.0" }],
                            },
                        ],
                    },
                ],
            };
            prepareTestEnvironment({}, appConfig, "testCustomORDContentFileWithIntegrationDependency.json");
            const result = extendCustomORDContentIfExists(appConfig, ordContent);

            expect(result.integrationDependencies).toHaveLength(1);
            const integrationDep = result.integrationDependencies[0];
            expect(integrationDep.ordId).toBe("customer.testapp:integrationDependency:externalDependencies:v1");
            expect(integrationDep.version).toBe("2.0.0");
            expect(integrationDep.title).toBe("Custom External Dependencies");
            expect(integrationDep.description).toBe("Patched via custom.ord.json");
            // Should preserve original values not in patch
            expect(integrationDep.releaseStatus).toBe("active");
            expect(integrationDep.visibility).toBe("public");
            expect(integrationDep.mandatory).toBe(false);
            expect(integrationDep.aspects).toHaveLength(1);
        });
    });
});

function prepareTestEnvironment(ordEnvVariables, appConfig, testFileName) {
    cds.env["ord"] = ordEnvVariables;
    appConfig.env.customOrdContentFile = testFileName;
    jest.spyOn(path, "join").mockReturnValueOnce(`${__dirname}/utils/${testFileName}`);
}
