const cds = require("@sap/cds");
const path = require("path");

beforeAll(() => {
    process.env.DEBUG = "true";
    const authentication = require("../../lib/auth/authentication");
    const { mockAuthenticationModule } = require("./utils/test-helpers");
    mockAuthenticationModule(authentication);
    jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
});

afterAll(() => {
    jest.restoreAllMocks();
});

describe("compiler", () => {
    let csn;

    beforeAll(async () => {
        cds.root = path.join(__dirname, "../bookshop");
        csn = await cds.load(path.join(cds.root, "srv"));
    });

    test("compile produces valid output", () => {
        const { compile } = require("../../lib/compiler");
        const document = compile(csn);

        expect(document.apiResources.length).toBeGreaterThan(0);
        expect(document.eventResources.length).toBeGreaterThan(0);
        expect(document.packages.length).toBeGreaterThan(0);
    });

    describe("issue #397 - multi-protocol unique ordId", () => {
        test("generates unique ordIds for multi-protocol services", () => {
            const { parse, resolve } = require("../../lib/compiler");

            jest.doMock("../../lib/protocol-resolver", () => ({
                resolveApiResourceProtocol: (name) => {
                    if (name === "MultiProtoService") {
                        return [
                            {
                                apiProtocol: "odata-v4",
                                entryPoints: ["/odata/v4/MultiProtoService"],
                                hasResourceDefinitions: true,
                            },
                            {
                                apiProtocol: "rest",
                                entryPoints: ["/rest/MultiProtoService"],
                                hasResourceDefinitions: true,
                            },
                        ];
                    }
                    return [];
                },
            }));

            const model = cds.linked(`
                service MultiProtoService {
                    entity Items { key ID: UUID; name: String; }
                };
            `);

            // Manually construct IR to test resolve
            const ir = {
                config: {
                    env: cds.env["ord"],
                    lastUpdate: "2024-11-04T14:33:25+01:00",
                    appName: "test-app",
                    ordNamespace: "customer.test",
                    packageName: "test-app",
                    policyLevels: ["none"],
                },
                services: [
                    {
                        name: "MultiProtoService",
                        definition: model.definitions["MultiProtoService"],
                        protocols: [
                            {
                                apiProtocol: "odata-v4",
                                entryPoints: ["/odata/v4/MultiProtoService"],
                                hasResourceDefinitions: true,
                            },
                            {
                                apiProtocol: "rest",
                                entryPoints: ["/rest/MultiProtoService"],
                                hasResourceDefinitions: true,
                            },
                        ],
                        extensions: {},
                        hasEvents: false,
                    },
                ],
                entities: [],
                externalServices: [],
                customOrd: null,
                extensions: [],
            };

            const resolved = resolve(ir);
            const apiResources = resolved.resolved.apiResources;

            expect(apiResources).toHaveLength(2);
            expect(apiResources[0].ordId).toBe("customer.test:apiResource:MultiProtoService:v1");
            expect(apiResources[1].ordId).toBe("customer.test:apiResource:MultiProtoService-rest:v1");

            // Verify ordIds are unique
            const ordIds = apiResources.map((r) => r.ordId);
            expect(new Set(ordIds).size).toBe(ordIds.length);

            jest.dontMock("../../lib/protocol-resolver");
            jest.resetModules();
        });
    });

    describe("issue #420 - ordId override propagates to resourceDefinitions URLs", () => {
        test("resourceDefinitions URLs use the overridden ordId", () => {
            const { resolve } = require("../../lib/compiler");

            const model = cds.linked(`
                @ORD.Extensions.ordId: 'custom.ns:apiResource:MyCustomId:v1'
                service OverrideService {
                    entity Items { key ID: UUID; name: String; }
                };
            `);

            const ir = {
                config: {
                    env: cds.env["ord"],
                    lastUpdate: "2024-11-04T14:33:25+01:00",
                    appName: "test-app",
                    ordNamespace: "customer.test",
                    packageName: "test-app",
                    policyLevels: ["none"],
                },
                services: [
                    {
                        name: "OverrideService",
                        definition: model.definitions["OverrideService"],
                        protocols: [
                            {
                                apiProtocol: "odata-v4",
                                entryPoints: ["/odata/v4/OverrideService"],
                                hasResourceDefinitions: true,
                            },
                        ],
                        extensions: { ordId: "custom.ns:apiResource:MyCustomId:v1" },
                        hasEvents: false,
                    },
                ],
                entities: [],
                externalServices: [],
                customOrd: null,
                extensions: [],
            };

            const resolved = resolve(ir);
            const apiResource = resolved.resolved.apiResources[0];

            // ordId should be the overridden value
            expect(apiResource.ordId).toBe("custom.ns:apiResource:MyCustomId:v1");

            // resourceDefinitions URLs should use the overridden ordId
            for (const rd of apiResource.resourceDefinitions) {
                expect(rd.url).toContain("custom.ns:apiResource:MyCustomId:v1");
                expect(rd.url).not.toContain("customer.test:apiResource:OverrideService:v1");
            }
        });

        test("resourceDefinitions URLs use overridden ordId in multi-protocol scenario", () => {
            const { resolve } = require("../../lib/compiler");

            const model = cds.linked(`
                @ORD.Extensions.ordId: 'custom.ns:apiResource:MyApi:v1'
                service MultiService {
                    entity Items { key ID: UUID; name: String; }
                };
            `);

            const ir = {
                config: {
                    env: cds.env["ord"],
                    lastUpdate: "2024-11-04T14:33:25+01:00",
                    appName: "test-app",
                    ordNamespace: "customer.test",
                    packageName: "test-app",
                    policyLevels: ["none"],
                },
                services: [
                    {
                        name: "MultiService",
                        definition: model.definitions["MultiService"],
                        protocols: [
                            {
                                apiProtocol: "odata-v4",
                                entryPoints: ["/odata/v4/MultiService"],
                                hasResourceDefinitions: true,
                            },
                            { apiProtocol: "rest", entryPoints: ["/rest/MultiService"], hasResourceDefinitions: true },
                        ],
                        extensions: { ordId: "custom.ns:apiResource:MyApi:v1" },
                        hasEvents: false,
                    },
                ],
                entities: [],
                externalServices: [],
                customOrd: null,
                extensions: [],
            };

            const resolved = resolve(ir);
            const apiResources = resolved.resolved.apiResources;

            // Both resources get the same overridden ordId (user's responsibility)
            // URLs must match their respective resource's ordId
            for (const resource of apiResources) {
                for (const rd of resource.resourceDefinitions) {
                    expect(rd.url).toContain(resource.ordId);
                }
            }
        });
    });

    describe("validate - ordId uniqueness", () => {
        test("throws on duplicate ordIds", () => {
            const { validate } = require("../../lib/compiler");

            const ir = {
                resolved: {
                    apiResources: [{ ordId: "ns:apiResource:Svc:v1" }, { ordId: "ns:apiResource:Svc:v1" }],
                    eventResources: [],
                    entityTypes: [],
                    integrationDependencies: [],
                },
            };

            expect(() => validate(ir)).toThrow("Duplicate ordId");
        });

        test("passes when all ordIds are unique", () => {
            const { validate } = require("../../lib/compiler");

            const ir = {
                resolved: {
                    apiResources: [{ ordId: "ns:apiResource:Svc:v1" }, { ordId: "ns:apiResource:Svc-rest:v1" }],
                    eventResources: [{ ordId: "ns:eventResource:Svc:v1" }],
                    entityTypes: [],
                    integrationDependencies: [],
                },
            };

            expect(() => validate(ir)).not.toThrow();
        });
    });
});
