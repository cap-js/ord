jest.mock("piscina", () => ({
    workerData: { model: {} },
}));

describe("compileMetadata", () => {
    afterEach(() => jest.resetModules());

    it("error is thrown when compilation fails", async () => {
        jest.mock("../../../lib/meta-data", () => (url) => Promise.reject(url));

        const compile = require("../../../lib/threads/compile");

        await expect(compile({ url: "test" })).rejects.toEqual("test");
    });

    it("should compile metadata and return response", async () => {
        jest.mock(
            "../../../lib/meta-data",
            () => (url) =>
                Promise.resolve({
                    response: url,
                }),
        );

        const compile = require("../../../lib/threads/compile");

        await expect(compile({ url: "test" })).resolves.toEqual('test');
    });
});
