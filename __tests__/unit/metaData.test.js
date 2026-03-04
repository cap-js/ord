const cds = require("@sap/cds");
const { compile: openapi } = require("@cap-js/openapi");
const { compile: asyncapi } = require("@cap-js/asyncapi");
const { compileMetadata } = require("../../lib/index");
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

    test("compileMetadata should return openapi content for a given URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:AdminService:v1/AdminService.oas3.json";
        const expectedResponse = {
            contentType: "application/json",
            response: "Openapi content",
        };
        openapi.mockImplementation(() => {
            return "Openapi content";
        });

        const result = await compileMetadata(url);

        expect(result).toEqual(expectedResponse);
    });

    test("compileMetadata should raise error when get openapi failed", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:AdminService:v1/AdminService.oas3.json";
        openapi.mockImplementation(() => {
            throw new Error("OpenApi error");
        });
        try {
            await compileMetadata(url);
        } catch (error) {
            expect(error.message).toBe("OpenApi error");
        }
    });

    test("compileMetadata should return asyncapi content for a given URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:eventResource:AdminService:v1/AdminService.asyncapi2.json";
        const expectedResponse = {
            contentType: "application/json",
            response: "Asyncapi content",
        };
        asyncapi.mockImplementation(() => {
            return "Asyncapi content";
        });

        const result = await compileMetadata(url);

        expect(result).toEqual(expectedResponse);
    });

    test("compileMetadata should raise error when get asyncapi failed", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:eventResource:AdminService:v1/AdminService.asyncapi2.json";
        asyncapi.mockImplementation(() => {
            throw new Error("AsyncApi error");
        });
        try {
            await compileMetadata(url);
        } catch (error) {
            expect(error.message).toBe("AsyncApi error");
        }
    });

    test("compileMetadata should return csn content for a given URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:AdminService:v1/AdminService.csn.json";
        const expectedResponse = {
            contentType: "application/json",
            response: "Csn content",
        };
        jest.spyOn(cdsc.for, "effective").mockImplementation(() => {
            return expectedResponse.response;
        });

        const result = await compileMetadata(url, "Csn content");

        expect(result).toEqual(expectedResponse);
    });

    test("compileMetadata should raise error when get csn failed", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:AdminService:v1/AdminService.csn.json";
        jest.spyOn(cdsc.for, "effective").mockImplementation(() => {
            throw new Error("Csn error");
        });
        try {
            await compileMetadata(url, "");
        } catch (error) {
            expect(error.message).toContain("Csn error");
        }
    });

    test("compileMetadata should return edmx content for a given URL", async () => {
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

        const result = await compileMetadata(url);

        expect(result).toEqual(expectedResponse);
    });

    test("compileMetadata should raise error when get edmx failed", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:CinemaService:v1/CinemaService.edmx";
        openapi.mockImplementation(() => {
            throw new Error("Edmx error");
        });
        try {
            await compileMetadata(url);
        } catch (error) {
            expect(error.message).toBe("Edmx error");
        }
    });

    test("compileMetadata should return mcp content for a given URL", async () => {
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

        const result = await compileMetadata(url);

        expect(result).toEqual(expectedResponse);
    });

    test("compileMetadata should return GraphQL SDL content with text/plain content type", async () => {
        const url =
            "/ord/v1/customer.sample:apiResource:sap.capire.incidents.GraphQLService:v1/sap.capire.incidents.GraphQLService.graphql";

        const result = await compileMetadata(url);

        expect(result.contentType).toBe("text/plain");
        expect(typeof result.response).toBe("string");
        expect(result.response).toContain("type Query");
    });

    test("compileMetadata should raise error when GraphQL SDL compilation fails", async () => {
        const url =
            "/ord/v1/customer.sample:apiResource:sap.capire.incidents.GraphQLService:v1/sap.capire.incidents.GraphQLService.graphql";

        // Mock cds.linked to return a model that causes generateSchema4 to fail
        jest.spyOn(cds, "linked").mockImplementation(() => {
            throw new Error("GraphQL schema error");
        });

        try {
            await compileMetadata(url);
        } catch (error) {
            expect(error.message).toBe("GraphQL schema error");
        }
    });

    test("compileMetadata should raise error when get mcp failed", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:AdminService:v1/AdminService.mcp.json";
        jest.spyOn(cds, "compile").mockImplementation(() => ({
            to: {
                mcp: () => {
                    throw new Error("MCP error");
                },
            },
        }));
        try {
            await compileMetadata(url);
        } catch (error) {
            expect(error.message).toBe("MCP error");
        }
    });

    test("compileMetadata should handle invalid URL format", async () => {
        const url = "/invalid/url/format";
        try {
            await compileMetadata(url);
        } catch (error) {
            expect(error.message).toContain("Invalid URL format");
        }
    });

    test("compileMetadata should handle missing service name in URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource::v1/Service.oas3.json";
        openapi.mockImplementation(() => "Mock content");

        const result = await compileMetadata(url);
        expect(result).toEqual({
            contentType: "application/json",
            response: "Mock content",
        });
    });

    test("compileMetadata should handle unknown file extension", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:TestService:v1/TestService.unknown";
        try {
            await compileMetadata(url);
        } catch (error) {
            expect(error.message).toContain("Unsupported format");
        }
    });

    test("compileMetadata should return correct content type for asyncapi", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:eventResource:TestService:v1/TestService.asyncapi2.json";
        asyncapi.mockImplementation(() => ({ test: "asyncapi content" }));

        const result = await compileMetadata(url);

        expect(result.contentType).toBe("application/json");
        expect(result.response).toEqual({ test: "asyncapi content" });
    });

    test("compileMetadata should handle edmx compilation with correct content type", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:TestService:v1/TestService.edmx";
        jest.spyOn(cds, "compile").mockImplementation(() => ({
            to: {
                edmx: () => "<edmx>content</edmx>",
            },
        }));

        const result = await compileMetadata(url);

        expect(result.contentType).toBe("application/xml");
        expect(result.response).toBe("<edmx>content</edmx>");
    });

    test("compileMetadata should handle complex service names with dots", async () => {
        const url =
            "/ord/v1/sap.test.cdsrc.sample:apiResource:my.complex.ServiceName:v1/my.complex.ServiceName.oas3.json";
        openapi.mockImplementation(() => "Complex service content");

        const result = await compileMetadata(url);

        expect(result.contentType).toBe("application/json");
        expect(result.response).toBe("Complex service content");
    });

    test("compileMetadata should handle version variations in URL", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:TestService:v2/TestService.csn.json";
        jest.spyOn(cdsc.for, "effective").mockImplementation(() => "Version 2 CSN");

        const result = await compileMetadata(url, "input csn");

        expect(result.contentType).toBe("application/json");
        expect(result.response).toBe("Version 2 CSN");
    });

    test("compileMetadata should pass compile options from cds.env", async () => {
        const url = "/ord/v1/sap.test.cdsrc.sample:apiResource:TestService:v1/TestService.oas3.json";
        const compileOptions = { openapi: { "openapi:path": "my_path" } };
        cds.env["ord"] = { compileOptions };

        openapi.mockImplementation((csn, options) => {
            expect(options["openapi:path"]).toBe("my_path");
            return "Content with compile options";
        });

        const result = await compileMetadata(url);

        expect(result.contentType).toBe("application/json");
        expect(result.response).toBe("Content with compile options");
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

            await compileMetadata(url, mockCsn);

            expect(capturedOptions["openapi:servers"]).toBe(JSON.stringify(servers));
        });

        test.each([
            ["missing", {}],
            ["empty array", { "@OpenAPI.servers": [] }],
            ["not an array", { "@OpenAPI.servers": "invalid" }],
        ])("should not set servers when annotation is %s", async (_, serviceDef) => {
            const mockCsn = { definitions: { TestService: serviceDef } };

            await compileMetadata(url, mockCsn);

            expect(capturedOptions["openapi:servers"]).toBeUndefined();
        });
    });
});
