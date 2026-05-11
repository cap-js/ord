const {
    createApiResources,
    mergeResourceProperties,
    buildResourceDefinitions,
} = require("../../../lib/model/apiResource");
const { RESOURCE_VISIBILITY } = require("../../../lib/constants");

beforeAll(() => {
    const authentication = require("../../../lib/auth/authentication");
    const { mockAuthenticationModule } = require("../utils/test-helpers");
    mockAuthenticationModule(authentication);
});

afterAll(() => {
    jest.restoreAllMocks();
});

describe("api-resource", () => {
    const baseConfig = {
        ordNamespace: "customer.app",
        lastUpdate: "2024-11-04T14:33:25+01:00",
        appName: "test-app",
        env: {},
        policyLevels: ["none"],
    };

    const packageIds = ["customer.app:package:test-api:v1", "customer.app:package:test-api-internal:v1"];

    describe("createApiResources", () => {
        test("creates resource for single-protocol service", () => {
            const service = {
                name: "CatalogService",
                definition: { name: "customer.app.CatalogService" },
                protocols: [
                    { apiProtocol: "odata-v4", entryPoints: ["/odata/v4/catalog"], hasResourceDefinitions: true },
                ],
                extensions: {},
            };
            const resources = createApiResources(service, baseConfig, packageIds, [{ type: "open" }]);
            expect(resources).toHaveLength(1);
            expect(resources[0].ordId).toBe("customer.app:apiResource:CatalogService:v1");
            expect(resources[0].apiProtocol).toBe("odata-v4");
        });

        test("creates unique ordIds for multi-protocol service", () => {
            const service = {
                name: "MultiService",
                definition: { name: "customer.app.MultiService" },
                protocols: [
                    { apiProtocol: "odata-v4", entryPoints: ["/odata/v4/multi"], hasResourceDefinitions: true },
                    { apiProtocol: "rest", entryPoints: ["/rest/multi"], hasResourceDefinitions: true },
                ],
                extensions: {},
            };
            const resources = createApiResources(service, baseConfig, packageIds, [{ type: "open" }]);
            expect(resources).toHaveLength(2);
            expect(resources[0].ordId).toBe("customer.app:apiResource:MultiService:v1");
            expect(resources[1].ordId).toBe("customer.app:apiResource:MultiService-rest:v1");
        });

        test("returns empty for private services", () => {
            const service = {
                name: "PrivateService",
                definition: { name: "customer.app.PrivateService" },
                protocols: [
                    { apiProtocol: "odata-v4", entryPoints: ["/odata/v4/private"], hasResourceDefinitions: true },
                ],
                extensions: { visibility: "private" },
            };
            expect(createApiResources(service, baseConfig, packageIds, [{ type: "open" }])).toHaveLength(0);
        });

        test("extensions override default properties (settle-then-derive)", () => {
            const service = {
                name: "CustomService",
                definition: { name: "customer.app.CustomService" },
                protocols: [
                    { apiProtocol: "odata-v4", entryPoints: ["/odata/v4/custom"], hasResourceDefinitions: true },
                ],
                extensions: { ordId: "custom.ns:apiResource:Override:v2", title: "Custom Title" },
            };
            const resources = createApiResources(service, baseConfig, packageIds, [{ type: "open" }]);
            expect(resources[0].ordId).toBe("custom.ns:apiResource:Override:v2");
            expect(resources[0].title).toBe("Custom Title");
        });

        test("resourceDefinitions URLs use the settled ordId", () => {
            const service = {
                name: "OverrideService",
                definition: { name: "customer.app.OverrideService" },
                protocols: [
                    { apiProtocol: "odata-v4", entryPoints: ["/odata/v4/override"], hasResourceDefinitions: true },
                ],
                extensions: { ordId: "custom.ns:apiResource:MyApi:v1" },
            };
            const resources = createApiResources(service, baseConfig, packageIds, [{ type: "open" }]);
            for (const rd of resources[0].resourceDefinitions) {
                expect(rd.url).toContain("custom.ns:apiResource:MyApi:v1");
            }
        });
    });

    describe("buildResourceDefinitions", () => {
        const accessStrategies = [{ type: "open" }];

        test("odata-v4 produces openapi-v3 + edmx", () => {
            const defs = buildResourceDefinitions("ns:apiResource:Svc:v1", "odata-v4", "Svc", accessStrategies);
            expect(defs).toHaveLength(2);
            expect(defs[0].type).toBe("openapi-v3");
            expect(defs[1].type).toBe("edmx");
        });

        test("odata-v2 produces only edmx", () => {
            const defs = buildResourceDefinitions("ns:apiResource:Svc:v1", "odata-v2", "Svc", accessStrategies);
            expect(defs).toHaveLength(1);
            expect(defs[0].type).toBe("edmx");
        });

        test("rest produces only openapi-v3", () => {
            const defs = buildResourceDefinitions("ns:apiResource:Svc:v1", "rest", "Svc", accessStrategies);
            expect(defs).toHaveLength(1);
            expect(defs[0].type).toBe("openapi-v3");
        });

        test("graphql produces graphql-sdl", () => {
            const defs = buildResourceDefinitions("ns:apiResource:Svc:v1", "graphql", "Svc", accessStrategies);
            expect(defs).toHaveLength(1);
            expect(defs[0].type).toBe("graphql-sdl");
            expect(defs[0].mediaType).toBe("text/plain");
        });

        test("mcp produces custom type", () => {
            const defs = buildResourceDefinitions("ns:apiResource:Svc:v1", "mcp", "Svc", accessStrategies);
            expect(defs).toHaveLength(1);
            expect(defs[0].url).toContain("mcp.json");
        });

        test("sap data subscription produces csn-interop", () => {
            const defs = buildResourceDefinitions(
                "ns:apiResource:Svc:v1",
                "sap.dp:data-subscription-api:v1",
                "Svc",
                accessStrategies,
            );
            expect(defs).toHaveLength(1);
            expect(defs[0].type).toBe("sap-csn-interop-effective-v1");
        });

        test("URLs contain the ordId", () => {
            const ordId = "customer.app:apiResource:TestSvc:v1";
            const defs = buildResourceDefinitions(ordId, "rest", "TestSvc", accessStrategies);
            expect(defs[0].url).toContain(ordId);
        });
    });

    describe("mergeResourceProperties", () => {
        test("annotations override fallback title", () => {
            const service = {
                name: "Svc",
                definition: { "name": "customer.app.Svc", "@title": "Annotated Title" },
                extensions: {},
            };
            const result = mergeResourceProperties(service, baseConfig, {
                packageId: "pkg:id",
                ordId: "ns:apiResource:Svc:v1",
                version: "1.0.0",
                fallbackTitle: "Fallback",
            });
            expect(result.title).toBe("Annotated Title");
        });

        test("extensions spread last and override everything", () => {
            const service = {
                name: "Svc",
                definition: { "name": "customer.app.Svc", "@title": "Annotated" },
                extensions: { title: "Extension Wins", ordId: "custom:ordId:v1" },
            };
            const result = mergeResourceProperties(service, baseConfig, {
                packageId: "pkg:id",
                ordId: "ns:apiResource:Svc:v1",
                version: "1.0.0",
                fallbackTitle: "Fallback",
            });
            expect(result.title).toBe("Extension Wins");
            expect(result.ordId).toBe("custom:ordId:v1");
        });

        test("protocolFields are included in output", () => {
            const service = {
                name: "Svc",
                definition: { name: "customer.app.Svc" },
                extensions: {},
            };
            const result = mergeResourceProperties(service, baseConfig, {
                packageId: "pkg:id",
                ordId: "ns:apiResource:Svc:v1",
                version: "1.0.0",
                fallbackTitle: "Svc",
                protocolFields: { apiProtocol: "rest", entryPoints: ["/rest/svc"] },
            });
            expect(result.apiProtocol).toBe("rest");
            expect(result.entryPoints).toEqual(["/rest/svc"]);
        });
    });
});
