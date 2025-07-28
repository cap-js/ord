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
                        exposedEntityTypes: [
                            {
                                ordId: "sap.odm:entityType:BusinessPartner:v2",
                            },
                            {
                                ordId: "sap.odm:entityType:BusinessPartner:v3",
                            },
                        ],
                    },
                    {
                        ordId: "sap.sm:apiResource:orginalService:v2",
                        partOfGroups: ["sap.cds:service:sap.test.cdsrc.sample:originalService"],
                        partOfPackage: "sap.sm:package:smDataProducts:v2",
                    },
                ],
            };
            prepareTestEnvironment({}, appConfig, "testCustomORDContentFileWithPatch.json");
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toMatchSnapshot();
        });
    });
});

function prepareTestEnvironment(ordEnvVariables, appConfig, testFileName) {
    cds.env["ord"] = ordEnvVariables;
    appConfig.env.customOrdContentFile = testFileName;
    jest.spyOn(path, "join").mockReturnValueOnce(`${__dirname}/utils/${testFileName}`);
}
