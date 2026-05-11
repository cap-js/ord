const cds = require("@sap/cds");
const path = require("path");

beforeAll(() => {
    const authentication = require("../../../lib/auth/authentication");
    const { mockAuthenticationModule } = require("../utils/test-helpers");
    mockAuthenticationModule(authentication);
    jest.spyOn(require("../../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
});

afterAll(() => {
    jest.restoreAllMocks();
});

describe("resolve", () => {
    const { resolve } = require("../../../lib/compiler/resolve");

    function buildDocument(services = [], entities = [], externalServices = []) {
        return {
            config: {
                env: cds.env["ord"],
                lastUpdate: "2024-11-04T14:33:25+01:00",
                appName: "test-app",
                ordNamespace: "customer.test",
                packageName: "test-app",
                policyLevels: ["none"],
            },
            services,
            entities,
            externalServices,
            customOrd: null,
            extensions: [],
        };
    }

    test("returns document with resolved property populated", () => {
        const document = buildDocument();
        const result = resolve(document);

        expect(result.resolved).toBeDefined();
        expect(result.resolved.products).toBeDefined();
        expect(result.resolved.packages).toBeDefined();
        expect(result.resolved.consumptionBundles).toBeDefined();
        expect(result.resolved.groups).toEqual([]);
        expect(result.resolved.apiResources).toEqual([]);
        expect(result.resolved.eventResources).toEqual([]);
        expect(result.resolved.entityTypes).toEqual([]);
        expect(result.resolved.integrationDependencies).toEqual([]);
    });

    test("creates api resources from services with protocols", () => {
        const model = cds.linked(`
            service CatalogService { entity Books { key ID: UUID; title: String; } };
        `);
        const services = [
            {
                name: "CatalogService",
                definition: model.definitions["CatalogService"],
                protocols: [
                    { apiProtocol: "odata-v4", entryPoints: ["/odata/v4/catalog"], hasResourceDefinitions: true },
                ],
                extensions: {},
                hasEvents: false,
            },
        ];
        const result = resolve(buildDocument(services));

        expect(result.resolved.apiResources).toHaveLength(1);
        expect(result.resolved.apiResources[0].apiProtocol).toBe("odata-v4");
    });

    test("creates event resources from services with hasEvents", () => {
        const model = cds.linked(`
            service NotifyService { event Alert { message: String; } };
        `);
        const services = [
            {
                name: "NotifyService",
                definition: model.definitions["NotifyService"],
                protocols: [],
                extensions: {},
                hasEvents: true,
            },
        ];
        const result = resolve(buildDocument(services));

        expect(result.resolved.eventResources).toHaveLength(1);
        expect(result.resolved.eventResources[0].ordId).toContain("eventResource");
    });

    test("creates groups for non-private services", () => {
        const model = cds.linked(`
            service PublicService { entity Items { key ID: UUID; } };
        `);
        const services = [
            {
                name: "PublicService",
                definition: model.definitions["PublicService"],
                protocols: [
                    { apiProtocol: "odata-v4", entryPoints: ["/odata/v4/public"], hasResourceDefinitions: true },
                ],
                extensions: {},
                hasEvents: false,
            },
        ];
        const result = resolve(buildDocument(services));

        expect(result.resolved.groups).toHaveLength(1);
        expect(result.resolved.groups[0].groupId).toContain("PublicService");
    });

    test("skips private services for api resources and groups", () => {
        const model = cds.linked(`
            service SecretService { entity Secrets { key ID: UUID; } };
        `);
        const services = [
            {
                name: "SecretService",
                definition: model.definitions["SecretService"],
                protocols: [
                    { apiProtocol: "odata-v4", entryPoints: ["/odata/v4/secret"], hasResourceDefinitions: true },
                ],
                extensions: { visibility: "private" },
                hasEvents: false,
            },
        ];
        const result = resolve(buildDocument(services));

        expect(result.resolved.apiResources).toHaveLength(0);
        expect(result.resolved.groups).toHaveLength(0);
    });

    test("creates integration dependencies for external services", () => {
        const externalServices = [{ name: "ExternalAPI", definition: { name: "ExternalAPI", kind: "service" } }];
        const result = resolve(buildDocument([], [], externalServices));

        expect(result.resolved.integrationDependencies).toHaveLength(1);
    });
});
