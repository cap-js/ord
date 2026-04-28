const cds = require("@sap/cds");
const path = require("path");
const {
    getCustomORDContent,
    compareAndHandleCustomORDContentWithExistingContent,
} = require("../../lib/extend-ord-with-custom");

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

    describe("extend-ord-with-custom", () => {
        it("should return undefined if there is no customOrdContentFile property in the .cdsrc.json", () => {
            appConfig.env.customOrdContentFile = undefined;

            const result = getCustomORDContent(appConfig);

            expect(result).toEqual(undefined);
        });

        it("should return undefined if customOrdContentFile property in the .cdsrc.json points to NON-EXISTING custom ord file", () => {
            appConfig.env.customOrdContentFile = "./ord/NotExistingCustom.ord.json";

            const result = getCustomORDContent(appConfig);

            expect(result).toEqual(undefined);
        });

        it("should ignore and log warn if found ord top-level primitive property in customOrdFile", () => {
            prepareTestEnvironment({ namespace: "sap.sample" }, appConfig, "testCustomORDContentFileThrowErrors.json");

            const result = compareAndHandleCustomORDContentWithExistingContent({}, getCustomORDContent(appConfig));

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
            prepareTestEnvironment({}, appConfig, "testCustomORDContentFileWithNewResources.json");

            const result = compareAndHandleCustomORDContentWithExistingContent({}, getCustomORDContent(appConfig));

            expect(result).toMatchSnapshot();
        });

        it("should enhance the list of generated ord resources", () => {
            prepareTestEnvironment({}, appConfig, "testCustomORDContentFileWithEnhanced.json");

            const result = compareAndHandleCustomORDContentWithExistingContent(
                {
                    packages: [
                        {
                            ordId: "sap.sm:package:smDataProducts:v1",
                            localId: "smDataProductsV1",
                        },
                    ],
                },
                getCustomORDContent(appConfig),
            );

            expect(result).toMatchSnapshot();
        });

        it("should should patch the existing generated ord resources", () => {
            prepareTestEnvironment({}, appConfig, "testCustomORDContentFileWithPatch.json");

            const result = compareAndHandleCustomORDContentWithExistingContent(
                {
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
                },
                getCustomORDContent(appConfig),
            );

            expect(result).toMatchSnapshot();
        });

        it("should patch MCP API resources via custom.ord.json", () => {
            prepareTestEnvironment({}, appConfig, "testCustomORDContentFileWithMCPOverride.json");

            const result = compareAndHandleCustomORDContentWithExistingContent(
                {
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
                },
                getCustomORDContent(appConfig),
            );

            expect(result.apiResources).toEqual([
                {
                    ordId: "customer.test:apiResource:mcp-server:v1",
                    visibility: "internal",
                    title: "Internal MCP Server for CAP Project",
                    shortDescription: "Custom MCP server description",
                    version: "2.1.0",
                    entryPoints: ["/mcp-server"],
                    releaseStatus: "beta",
                    apiProtocol: "mcp",
                },
            ]);
        });

        it("should patch IntegrationDependency via custom.ord.json", () => {
            prepareTestEnvironment({}, appConfig, "testCustomORDContentFileWithIntegrationDependency.json");

            const result = compareAndHandleCustomORDContentWithExistingContent(
                {
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
                },
                getCustomORDContent(appConfig),
            );

            expect(result.integrationDependencies).toEqual([
                {
                    ordId: "customer.testapp:integrationDependency:externalDependencies:v1",
                    title: "Custom External Dependencies",
                    version: "2.0.0",
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
                    description: "Patched via custom.ord.json",
                },
            ]);
        });
    });
});

function prepareTestEnvironment(ordEnvVariables, appConfig, testFileName) {
    cds.env["ord"] = ordEnvVariables;
    appConfig.env.customOrdContentFile = testFileName;
    jest.spyOn(path, "join").mockReturnValueOnce(`${__dirname}/utils/${testFileName}`);
}
