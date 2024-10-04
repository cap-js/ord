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
    };
});

const cds = require("@sap/cds");

describe('extendOrdWithCustom', () => {
    let appConfig = {};

    beforeEach(() => {
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
        it('should return custom ORD content if path it exists', () => {
            const ordContent = {};
            prepareTestEnvironment({}, appConfig, 'testCustomORDContentFile.json');
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toMatchSnapshot();
        });

        it('should not extend existing object if custom ORD content does not exist', () => {
            const ordContent = {};
            appConfig.env.customOrdContentFile = undefined;
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toEqual(ordContent);
        });

        it('should throw error if custom ORD content has conflict with cdsrc.json', () => {
            const ordContent = { namespace: "sap.sample" };
            prepareTestEnvironment({ namespace: "sap.sample" }, appConfig, 'testCustomORDContentFileThrowErrors.json');
            console.error = jest.fn();
            extendCustomORDContentIfExists(appConfig, ordContent);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('.cdsrc.json: namespace'));
        });

        it('should throw error if custom ORD content has conflict with default value', () => {
            const ordContent = { openResourceDiscovery: "1.9" };
            prepareTestEnvironment({}, appConfig, 'testCustomORDContentFileConflictWithDefault.json');
            console.error = jest.fn();
            extendCustomORDContentIfExists(appConfig, ordContent);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('default value: openResourceDiscovery'));
        });

        it('should extend if custom ORD obj OrdId has no conflict with existing content', () => {
            const ordContent = { packages: [{ ordId: "sap.sm:package:smDataProducts:different" }] };
            prepareTestEnvironment({}, appConfig, 'testCustomORDContentFile.json');
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toMatchSnapshot();
        });

        it('should update if custom ORD obj OrdId has conflict with existing content', () => {
            const ordContent = { packages: [{ ordId: "sap.sm:package:smDataProducts:v1", localId: "differentLocalId" }] };
            prepareTestEnvironment({}, appConfig, 'testCustomORDContentFile.json');
            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toMatchSnapshot();
        });

        it('should update nested content ', () => {
            const ordContent = {
                packages: [{
                    ordId: "sap.sm:package:smDataProducts:v1",
                    localId: "differentLocalId"
                }],
                apiResources: [{
                    ordId: "sap.sm:apiResource:SupplierService:v1",
                    partOfGroups: [
                        "sap.cds:service:sap.test.cdsrc.sample:originalService"
                    ],
                    partOfPackage: "sap.sm:package:smDataProducts:v2"
                },
                {
                    ordId: "sap.sm:apiResource:orginalService:dontUpdate",
                    partOfGroups: [
                        "sap.cds:service:sap.test.cdsrc.sample:originalService"
                    ],
                    partOfPackage: "sap.sm:package:smDataProducts:v2"
                }]
            };
            prepareTestEnvironment({}, appConfig, 'testCustomORDContentFileWithNestedConflicts.json');
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
