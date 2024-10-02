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
            cds.env["ord"] = {};
            const testCustomORDContentFile = '/utils/testCustomORDContentFile.json';
            const customORDContent = { content: 'content' };
            path.join.mockReturnValue(__dirname + testCustomORDContentFile);

            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toEqual(customORDContent);
        });

        it('should not extend existing object if custom ORD content does not exist', () => {
            const ordContent = {};
            appConfig.env.customOrdContentFile = undefined;

            const result = extendCustomORDContentIfExists(appConfig, ordContent);
            expect(result).toEqual(ordContent);
        });

        it('should throw error if custom ORD content has conflict with cdsrc.json', () => {
            const ordContent = { namespace: "sap.sample" };
            cds.env["ord"] = { namespace: "sap.sample" };
            appConfig.env.customOrdContentFile = 'testCustomORDContentFileThrowErrors.json';

            const testCustomORDContentFile = '/utils/testCustomORDContentFileThrowErrors.json';
            path.join.mockReturnValue(__dirname + testCustomORDContentFile);

            console.error = jest.fn();

            extendCustomORDContentIfExists(appConfig, ordContent);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('.cdsrc.json: namespace'));
        });

        it('should throw error if custom ORD content has conflict with default value', () => {
            const ordContent = { openResourceDiscovery: "1.9" };
            cds.env["ord"] = {};
            appConfig.env.customOrdContentFile = 'testCustomORDContentFileConflictWithDefault.json';

            const testCustomORDContentFile = '/utils/testCustomORDContentFileConflictWithDefault.json';
            path.join.mockReturnValue(__dirname + testCustomORDContentFile);

            console.error = jest.fn();

            extendCustomORDContentIfExists(appConfig, ordContent);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('default value: openResourceDiscovery'));
        });

        it('should extend if custom ORD obj OrdId has no conflict with existing content', () => {
            const ordContent = { packages: [{ ordId: "sap.sm:package:smDataProducts:different" }] };
            cds.env["ord"] = {};
            const expectedResult = {
                namespace: "sap.sample",
                packages: [{ ordId: "sap.sm:package:smDataProducts:v1", localId: "smDataProducts" },
                           { ordId: "sap.sm:package:smDataProducts:different" }]
            };
            appConfig.env.customOrdContentFile = 'testCustomORDContentFileThrowErrors.json';

            const testCustomORDContentFile = '/utils/testCustomORDContentFileThrowErrors.json';
            path.join.mockReturnValue(__dirname + testCustomORDContentFile);

            const result = extendCustomORDContentIfExists(appConfig, ordContent);

            expect(result.namespace).toEqual(expectedResult.namespace);
            expect(result.packages.map(a => a.ordId).sort()).toEqual(expectedResult.packages.map(a => a.ordId).sort());
        });

        it('should update if custom ORD obj OrdId has conflict with existing content', () => {
            const ordContent = { packages: [{ ordId: "sap.sm:package:smDataProducts:v1", localId: "differentLocalId" }] };
            cds.env["ord"] = {};
            const expectedResult = {
                namespace: "sap.sample",
                packages: [{ ordId: "sap.sm:package:smDataProducts:v1", localId: "differentLocalId" }]
            };
            appConfig.env.customOrdContentFile = 'testCustomORDContentFileThrowErrors.json';

            const testCustomORDContentFile = '/utils/testCustomORDContentFileThrowErrors.json';
            path.join.mockReturnValue(__dirname + testCustomORDContentFile);

            const result = extendCustomORDContentIfExists(appConfig, ordContent);

            expect(result.namespace).toEqual(expectedResult.namespace);
            expect(result.packages.map(a => a.ordId).sort()).toEqual(expectedResult.packages.map(a => a.ordId).sort());
        });
    });
});
