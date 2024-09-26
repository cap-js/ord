process.env['NODE_DEV'] = 'TEST';
const { log } = require('console');
const ord = require('../../lib/ord');
const path = require('path');

jest.mock('path', () => ({
    join: jest.fn(),
}));

jest.mock("./utils/testCustomORDContentFile.json", () => ({
    custom: 'content',
}));

describe('ord', () => {
    beforeEach(() => {
        global.env = {};
    });

    afterEach(() => {
        jest.resetModules();
    });

    describe('addCustomORDContentIfExist', () => {
        it('should return custom ORD content if path it exists', () => {
            let oReturn = {};
            const testCustomORDContentFile = '/utils/testCustomORDContentFile.json';
            global.env.customOrdContentFile = 'customOrdContentFile.json';
            const customORDContent = { custom: 'content' };
            path.join.mockReturnValue(__dirname + testCustomORDContentFile);

            const result = ord.addCustomORDContentIfExist(global, oReturn);
            expect(result).toEqual(customORDContent);
        });
    });
});
