const cds = require("@sap/cds");
const { compile: openapi } = require("@cap-js/openapi");
const { compile: asyncapi } = require("@cap-js/asyncapi");
const { getMetadata } = require("../../lib/index");
const cdsc = require("@sap/cds-compiler/lib/main");

jest.mock("@cap-js/openapi", () => ({
    compile: jest.fn(),
}));

jest.mock("@cap-js/asyncapi", () => ({
    compile: jest.fn(),
}));

describe("metaData", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("getMetadata should return openapi content for a given URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:AdminService:v1/AdminService.oas3.json";
        const expectedResponse = {
            contentType: "application/json",
            response: "Openapi content",
        };
        openapi.mockImplementation(() => {
            return "Openapi content";
        });

        const result = await getMetadata(url);

        expect(result).toEqual(expectedResponse);
    });

    test("getMetadata should raise error when get openapi failed", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:AdminService:v1/AdminService.oas3.json";
        openapi.mockImplementation(() => {
            throw new Error("OpenApi error");
        });
        try {
            await getMetadata(url);
        } catch (error) {
            expect(error.message).toBe("OpenApi error");
        }
    });

    test("getMetadata should return asyncapi content for a given URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:eventResource:AdminService:v1/AdminService.asyncapi2.json";
        const expectedResponse = {
            contentType: "application/json",
            response: "Asyncapi content",
        };
        asyncapi.mockImplementation(() => {
            return "Asyncapi content";
        });

        const result = await getMetadata(url);

        expect(result).toEqual(expectedResponse);
    });

    test("getMetadata should raise error when get asyncapi failed", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:eventResource:AdminService:v1/AdminService.asyncapi2.json";
        asyncapi.mockImplementation(() => {
            throw new Error("AsyncApi error");
        });
        try {
            await getMetadata(url);
        } catch (error) {
            expect(error.message).toBe("AsyncApi error");
        }
    });

    test("getMetadata should return csn content for a given URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:AdminService:v1/AdminService.csn.json";
        const expectedResponse = {
            contentType: "application/json",
            response: "Csn content",
        };
        jest.spyOn(cdsc.for, "effective").mockImplementation(() => {
            return expectedResponse.response;
        });

        const result = await getMetadata(url, "Csn content");

        expect(result).toEqual(expectedResponse);
    });

    test("getMetadata should raise error when get csn failed", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:AdminService:v1/AdminService.csn.json";
        jest.spyOn(cdsc.for, "effective").mockImplementation(() => {
            throw new Error("Csn error");
        });
        try {
            await getMetadata(url, "");
        } catch (error) {
            expect(error.message).toContain("Csn error");
        }
    });

    test("getMetadata should return edmx content for a given URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:CinemaService:v1/CinemaService.edmx";
        const expectedResponse = {
            contentType: "application/xml",
            response: "Edmx content",
        };
        jest.spyOn(cds, "compile").mockImplementation(() => {
            return {
                to: {
                    edmx: () => "Edmx content",
                },
            };
        });

        const result = await getMetadata(url);

        expect(result).toEqual(expectedResponse);
    });

    test("getMetadata should raise error when get edmx failed", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:CinemaService:v1/CinemaService.edmx";
        openapi.mockImplementation(() => {
            throw new Error("Edmx error");
        });
        try {
            await getMetadata(url);
        } catch (error) {
            expect(error.message).toBe("Edmx error");
        }
    });
});
