const path = require('path');
const { extendCustomORDContentIfExists } = require('../../lib/extendOrdWithCustom');

jest.mock('path', () => ({
    join: jest.fn(),
}));

jest.mock("@sap/cds", () => {
    const actualCds = jest.requireActual('@sap/cds');
    return {
        ...actualCds,
        env: {},
        log: jest.fn(() => ({
            warn: jest.fn(),
        })),
    };
});

const cds = require("@sap/cds");

describe('extendOrdWithCustom', () => {
    let appConfig = {};
    let logger;

    beforeEach(() => {
        logger = { warn: jest.fn() };
        appConfig = {
            env: {
                customOrdContentFile: 'customOrdContentFile.json',
            },
        };
    });

    afterEach(() => {
        jest.resetModules();
    });

    describe('extendCustomORDContentIfExists', () => {
        it('should skip if there is no custom ord file', () => {
            const ordContent = {};
            appConfig.env.customOrdContentFile = undefined;
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toEqual(ordContent);
        });

        it('should ignore and log warn if found ord top-level primitive property in customOrdFile', () => {
            const ordContent = {};
            prepareTestEnvironment({ namespace: "sap.sample" }, appConfig, 'testCustomORDContentFileThrowErrors.json');
            const result = extendCustomORDContentIfExists(appConfig, ordContent, logger);
            expect(logger.warn).toHaveBeenCalledTimes(3);
            expect(result).toMatchSnapshot();
        });

        it('should add new ord resources that are not supported by cap framework', () => {
            const ordContent = {};
            prepareTestEnvironment({}, appConfig, 'testCustomORDContentFileWithNewResources.json');
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toMatchSnapshot();
        });

        it('should enhance the list of generated ord resources', () => {
            const ordContent = { packages: [{ ordId: "sap.sm:package:smDataProducts:v1", localId: "smDataProductsV1" }] };
            prepareTestEnvironment({}, appConfig, 'testCustomORDContentFileWithEnhanced.json');
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toMatchSnapshot();
        });

        it('should should patch the existing generated ord resources', () => {
            const ordContent = {
                packages: [{
                    ordId: "sap.sm:package:smDataProducts:v1",
                    localId: "smDataProductsV1"
                }],
                apiResources: [{
                    ordId: "sap.sm:apiResource:SupplierService:v1",
                    title: "should be removed",
                    partOfGroups: [
                        "sap.cds:service:sap.test.cdsrc.sample:originalService"
                    ],
                    partOfPackage: "sap.sm:package:smDataProducts:v2",
                    extensible: {
                        "supported": "no"
                    },
                    entityTypeMappings: [
                        {
                            entityTypeTargets: [
                                {
                                    ordId: "sap.odm:entityType:BusinessPartner:v2"
                                },
                                {
                                    ordId: "sap.odm:entityType:BusinessPartner:v3"
                                }
                            ]
                        }
                    ]
                },
                {
                    ordId: "sap.sm:apiResource:orginalService:v2",
                    partOfGroups: [
                        "sap.cds:service:sap.test.cdsrc.sample:originalService"
                    ],
                    partOfPackage: "sap.sm:package:smDataProducts:v2",
                    entityTypeMappings: [
                        {
                            entityTypeTargets: []
                        }
                    ]
                }]
            };
            prepareTestEnvironment({}, appConfig, 'testCustomORDContentFileWithPatch.json');
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toMatchSnapshot();
        });
    });
});

function prepareTestEnvironment(ordEnvVariables, appConfig, testFileName) {
    cds.env["ord"] = ordEnvVariables;
    appConfig.env.customOrdContentFile = testFileName;
    path.join.mockReturnValue(`${__dirname}/utils/${testFileName}`);
}
