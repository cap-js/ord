const { addCustomORDContentIfExists } = require('../../lib/extendOrdWithCustom');
const path = require('path');

jest.mock('path', () => ({
    join: jest.fn(),
}));

describe('ord', () => {
    let appConfig = {};

    afterEach(() => {
        jest.resetModules();
    });

    describe('addCustomORDContentIfExists', () => {
        jest.mock("./utils/testCustomORDContentFile.json", () => ({
            custom: 'content',
        }));

        beforeEach(() => {
            appConfig = {
                env: {
                    customOrdContentFile: 'customOrdContentFile.json',
                },
            };
        });

        it('should return custom ORD content if path it exists', () => {

            let oReturn = {};
            const testCustomORDContentFile = '/utils/testCustomORDContentFile.json';
            const customORDContent = { custom: 'content' };
            path.join.mockReturnValue(__dirname + testCustomORDContentFile);

            const result = addCustomORDContentIfExists(appConfig, oReturn);
            expect(result).toEqual(customORDContent);
        });

        it('should not extend existing object if custom ORD content does not exist', () => {
            let oReturn = {};
            appConfig.env.customOrdContentFile = undefined;

            const result = addCustomORDContentIfExists(appConfig, oReturn);
            expect(result).toEqual(oReturn);
        });
    });
});
