const cds = require("@sap/cds");
const { compile: openapi } = require("@cap-js/openapi");
const { compile: asyncapi } = require("@cap-js/asyncapi");
const { getMetadata } = require("../../lib/index");
const { isMCPPluginAvailable } = require("../../lib/mcpAdapter");
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

    describe("isMCPPluginAvailable", () => {
        test("should return true when MCP plugin is available", () => {
            const result = isMCPPluginAvailable(() => {
                return true;
            });

            expect(result).toBe(true);
        });

        test("should return false when MCP plugin is not available", () => {
            const result = isMCPPluginAvailable(() => {
                throw new Error("Cannot resolve module");
            });

            expect(result).toBe(false);
        });
    });
    test("getMetadata should handle invalid URL format", async () => {
        const url = "/invalid/url/format";
        try {
            await getMetadata(url);
        } catch (error) {
            expect(error.message).toContain("Invalid URL format");
        }
    });

    test("getMetadata should handle missing service name in URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource::v1/Service.oas3.json";
        openapi.mockImplementation(() => "Mock content");

        const result = await getMetadata(url);
        expect(result).toEqual({
            contentType: "application/json",
            response: "Mock content",
        });
    });

    test("getMetadata should handle unknown file extension", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:TestService:v1/TestService.unknown";
        try {
            await getMetadata(url);
        } catch (error) {
            expect(error.message).toContain("Unsupported format");
        }
    });

    test("getMetadata should return correct content type for asyncapi", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:eventResource:TestService:v1/TestService.asyncapi2.json";
        asyncapi.mockImplementation(() => ({ test: "asyncapi content" }));

        const result = await getMetadata(url);

        expect(result.contentType).toBe("application/json");
        expect(result.response).toEqual({ test: "asyncapi content" });
    });

    test("getMetadata should handle edmx compilation with correct content type", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:TestService:v1/TestService.edmx";
        jest.spyOn(cds, "compile").mockImplementation(() => ({
            to: {
                edmx: () => "<edmx>content</edmx>",
            },
        }));

        const result = await getMetadata(url);

        expect(result.contentType).toBe("application/xml");
        expect(result.response).toBe("<edmx>content</edmx>");
    });

    test("getMetadata should handle complex service names with dots", async () => {
        const url =
            "/ord/v1/sap.test.cdsrc.sample:apiResource:my.complex.ServiceName:v1/my.complex.ServiceName.oas3.json";
        openapi.mockImplementation(() => "Complex service content");

        const result = await getMetadata(url);

        expect(result.contentType).toBe("application/json");
        expect(result.response).toBe("Complex service content");
    });

    test("getMetadata should handle version variations in URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:TestService:v2/TestService.csn.json";
        jest.spyOn(cdsc.for, "effective").mockImplementation(() => "Version 2 CSN");

        const result = await getMetadata(url, "input csn");

        expect(result.contentType).toBe("application/json");
        expect(result.response).toBe("Version 2 CSN");
    });

    test("getMetadata should pass compile options from cds.env", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:TestService:v1/TestService.oas3.json";
        const compileOptions = { "openapi:path": "my_path" };
        cds.env["ord"] = { compileOptions };

        openapi.mockImplementation((csn, options) => {
            expect(options["openapi:path"]).toBe("my_path");
            return "Content with compile options";
        });

        const result = await getMetadata(url);

        expect(result.contentType).toBe("application/json");
        expect(result.response).toBe("Content with compile options");
    });
});
