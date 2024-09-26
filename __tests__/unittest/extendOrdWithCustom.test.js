const { extendCustomORDContentIfExists } = require('../../lib/extendOrdWithCustom');
const path = require('path');

jest.mock('path', () => ({
    join: jest.fn(),
}));

describe('ord', () => {
    let appConfig = {};

    afterEach(() => {
        jest.resetModules();
    });

    describe('extendCustomORDContentIfExists', () => {
        beforeEach(() => {
            appConfig = {
                env: {
                    customOrdContentFile: 'customOrdContentFile.json',
                },
            };
        });

        it('should return custom ORD content if path it exists', () => {
            const ordContent = {};
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

        it('should throw error if custom ORD content has conflict with existing content', () => {
            const ordContent = { namespace: "sap.sample" };
            appConfig.env.customOrdContentFile = 'testCustomORDContentFileThrowErrors.json';

            const testCustomORDContentFile = '/utils/testCustomORDContentFileThrowErrors.json';
            path.join.mockReturnValue(__dirname + testCustomORDContentFile);

            expect(() => extendCustomORDContentIfExists(appConfig, ordContent)).toThrowError();
        });

        it('should throw error if custom ORD obj OrdId has conflict with existing content', () => {
            const ordContent = { packages: [{ ordId: "sap.sm:package:smDataProducts:v1" }] };
            appConfig.env.customOrdContentFile = 'testCustomORDContentFileThrowErrors.json';

            const testCustomORDContentFile = '/utils/testCustomORDContentFileThrowErrors.json';
            path.join.mockReturnValue(__dirname + testCustomORDContentFile);

            expect(() => extendCustomORDContentIfExists(appConfig, ordContent)).toThrowError();
        });

        it('should not throw error if custom ORD obj OrdId has no conflict with existing content', () => {
            const ordContent = { packages: [{ ordId: "sap.sm:package:smDataProducts:different" }] };
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
    });
});
