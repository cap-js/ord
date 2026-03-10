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

        await expect(getMetadata(url)).rejects.toThrow("OpenApi error");
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

        await expect(getMetadata(url)).resolves.toEqual(expectedResponse);
    });

    test("getMetadata should raise error when get asyncapi failed", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:eventResource:AdminService:v1/AdminService.asyncapi2.json";
        asyncapi.mockImplementation(() => {
            throw new Error("AsyncApi error");
        });

        await expect(getMetadata(url)).rejects.toThrow("AsyncApi error");
    });

    test("getMetadata should return csn content for a given URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:AdminService:v1/AdminService.csn.json";
        const expectedResponse = {
            response: "Csn content",
            contentType: "application/json",
        };
        jest.spyOn(cdsc.for, "effective").mockImplementation(() => {
            return expectedResponse.response;
        });

        await expect(getMetadata(url, "Csn content")).resolves.toEqual(expectedResponse);
    });

    test("getMetadata should raise error when get csn failed", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:AdminService:v1/AdminService.csn.json";
        jest.spyOn(cdsc.for, "effective").mockImplementation(() => {
            throw new Error("Csn error");
        });

        await expect(getMetadata(url, "")).rejects.toThrow("Csn error");
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

        await expect(getMetadata(url)).resolves.toEqual(expectedResponse);
    });

    test("getMetadata should raise error when get OpenAPI failed", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:CinemaService:v1/CinemaService.oas3.json";
        openapi.mockImplementation(() => {
            throw new Error("OpenAPI error");
        });

        await expect(getMetadata(url)).rejects.toThrow("OpenAPI error");
    });

    test("getMetadata should return mcp content for a given URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:AdminService:v1/AdminService.mcp.json";
        const mockMcpServerCard = {
            $schema: "https://example.com/mcp-server-card.schema.json",
            name: "sap.cds.service/admin",
            title: "AdminService",
            version: "1.0.0",
            description: "Admin service",
            tools: [],
        };
        const expectedResponse = {
            contentType: "application/json",
            response: JSON.stringify(mockMcpServerCard),
        };
        jest.spyOn(cds, "compile").mockImplementation(() => ({
            to: {
                mcp: () => JSON.stringify(mockMcpServerCard),
            },
        }));

        await expect(getMetadata(url)).resolves.toEqual(expectedResponse);
    });

    test("getMetadata should return GraphQL SDL content with text/plain content type", async () => {
        const url =
            "/ord/v1/customer.sample:apiResource:sap.capire.incidents.GraphQLService:v1/sap.capire.incidents.GraphQLService.graphql";

        const result = await getMetadata(url);

        expect(result.contentType).toBe("text/plain");
        expect(typeof result.response).toBe("string");
        expect(result.response).toContain("type Query");
    });

    test("getMetadata should raise error when GraphQL SDL compilation fails", async () => {
        const url =
            "/ord/v1/customer.sample:apiResource:sap.capire.incidents.GraphQLService:v1/sap.capire.incidents.GraphQLService.graphql";

        // Mock cds.linked to return a model that causes generateSchema4 to fail
        jest.spyOn(cds, "linked").mockImplementation(() => {
            throw new Error("GraphQL schema error");
        });

        await expect(getMetadata(url)).rejects.toThrow("GraphQL schema error");
    });

    test("getMetadata should raise error when get mcp failed", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:AdminService:v1/AdminService.mcp.json";
        jest.spyOn(cds, "compile").mockImplementation(() => ({
            to: {
                mcp: () => {
                    throw new Error("MCP error");
                },
            },
        }));

        await expect(getMetadata(url)).rejects.toThrow("MCP error");
    });

    test("getMetadata should handle missing service name in URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource::v1/Service.oas3.json";
        openapi.mockImplementation(() => "Mock content");

        await expect(getMetadata(url)).resolves.toEqual({
            response: "Mock content",
            contentType: "application/json",
        });
    });

    test("getMetadata should handle unknown file extension", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:TestService:v1/TestService.unknown";

        await expect(getMetadata(url)).rejects.toThrow("Unsupported format");
    });

    test("getMetadata should return correct content type for asyncapi", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:eventResource:TestService:v1/TestService.asyncapi2.json";
        asyncapi.mockImplementation(() => ({ test: "asyncapi content" }));

        await expect(getMetadata(url)).resolves.toEqual({
            contentType: "application/json",
            response: { test: "asyncapi content" },
        });
    });

    test("getMetadata should handle edmx compilation with correct content type", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:TestService:v1/TestService.edmx";
        jest.spyOn(cds, "compile").mockImplementation(() => ({
            to: {
                edmx: () => "<edmx>content</edmx>",
            },
        }));

        await expect(getMetadata(url)).resolves.toEqual({
            contentType: "application/xml",
            response: "<edmx>content</edmx>",
        });
    });

    test("getMetadata should handle complex service names with dots", async () => {
        const url =
            "/ord/v1/sap.test.cdsrc.sample:apiResource:my.complex.ServiceName:v1/my.complex.ServiceName.oas3.json";
        openapi.mockImplementation(() => "Complex service content");

        await expect(getMetadata(url)).resolves.toEqual({
            contentType: "application/json",
            response: "Complex service content",
        });
    });

    test("getMetadata should handle version variations in URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:TestService:v2/TestService.csn.json";
        jest.spyOn(cdsc.for, "effective").mockImplementation(() => "Version 2 CSN");

        await expect(getMetadata(url)).resolves.toEqual({
            response: "Version 2 CSN",
            contentType: "application/json",
        });
    });

    test("getMetadata should pass compile options from cds.env", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:TestService:v1/TestService.oas3.json";
        const compileOptions = { openapi: { "openapi:path": "my_path" } };
        cds.env["ord"] = { compileOptions };

        openapi.mockImplementation((csn, options) => {
            expect(options["openapi:path"]).toBe("my_path");
            return "Content with compile options";
        });

        await expect(getMetadata(url)).resolves.toEqual({
            contentType: "application/json",
            response: "Content with compile options",
        });
    });

    describe("@OpenAPI.servers annotation", () => {
        const url = "/ord/v1/ns:apiResource:TestService:v1/TestService.oas3.json";
        let capturedOptions;

        beforeEach(() => {
            capturedOptions = null;
            openapi.mockImplementation((csn, options) => {
                capturedOptions = options;
                return "content";
            });
        });

        test("should pass servers from annotation to openapi compiler", async () => {
            const servers = [{ url: "https://api.example.com", description: "Production" }];
            const mockCsn = {
                definitions: { TestService: { "@OpenAPI.servers": servers } },
            };

            await getMetadata(url, mockCsn);

            expect(capturedOptions["openapi:servers"]).toBe(JSON.stringify(servers));
        });

        test.each([
            ["missing", {}],
            ["empty array", { "@OpenAPI.servers": [] }],
            ["not an array", { "@OpenAPI.servers": "invalid" }],
        ])("should not set servers when annotation is %s", async (_, serviceDef) => {
            const mockCsn = { definitions: { TestService: serviceDef } };

            await getMetadata(url, mockCsn);

            expect(capturedOptions["openapi:servers"]).toBeUndefined();
        });
    });
});
