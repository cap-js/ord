process.env['NODE_DEV'] = 'TEST';
const ord = require('../../lib/ord');
const path = require('path');

const mockFilePath =
jest.mock('path', () => ({
    join: jest.fn(),
}));

jest.mock("./utils/testCustomORDContentFile.json", () => ({
    custom: 'content',
}), { virtual: true });

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
            global.env.customOrdContentFile = 'customOrdContentFile.json';
            const customORDContent = { custom: 'content' };
            path.join.mockReturnValue();

            const result = ord.addCustomORDContentIfExist(global, oReturn);

            expect(result).toEqual(customORDContent);
        });
    });
});
