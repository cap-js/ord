const cds = require("@sap/cds");

const { RESOURCE_VISIBILITY } = require("../../../lib/constants");
const { createIntegrationDependencies, createIntegrationDependency, RESOLVERS } = require("../../../lib/templates/integration-dependency");

describe("RESOLVERS.version", () => {
    it("defaults to 1.0.0 when env has no integrationDependency config", () => {
        const result = RESOLVERS.version({
            env: {},
        });

        expect(result).toBe("1.0.0");
    });

    it("uses env.integrationDependency.version when set", () => {
        const result = RESOLVERS.version({
            env: { integrationDependency: { version: "3.2.1" } },
        });

        expect(result).toBe("3.2.1");
    });
});

describe("RESOLVERS.ordId", () => {
    it("builds ordId from namespace with default major version", () => {
        const result = RESOLVERS.ordId({
            ordNamespace: "sap.test",
            env: {},
        });

        expect(result).toBe("sap.test:integrationDependency:externalDependencies:v1");
    });

    it("uses major version from env.integrationDependency.version", () => {
        const result = RESOLVERS.ordId({
            ordNamespace: "sap.test",
            env: { integrationDependency: { version: "3.2.1" } },
        });

        expect(result).toBe("sap.test:integrationDependency:externalDependencies:v3");
    });
});

describe("RESOLVERS.visibility", () => {
    it("defaults to public when env has no integrationDependency config", () => {
        const result = RESOLVERS.visibility({
            env: {},
        });

        expect(result).toBe(RESOURCE_VISIBILITY.public);
    });

    it("uses env.integrationDependency.visibility when set", () => {
        const result = RESOLVERS.visibility({
            env: {
                integrationDependency: { visibility: RESOURCE_VISIBILITY.internal },
            },
        });

        expect(result).toBe(RESOURCE_VISIBILITY.internal);
    });
});

describe("RESOLVERS.partOfPackage", () => {
    it("resolves to the general package for a public integration dependency", () => {
        const result = RESOLVERS.partOfPackage({
            appName: "TestApp",
            ordNamespace: "sap.test",
            packageName: "TestPackage",
            env: {},
        });

        expect(result).toBe("sap.test:package:TestApp:v1");
    });

    it("resolves to the integrationDependency-specific package when hasSAPPolicyLevel is true", () => {
        const result = RESOLVERS.partOfPackage({
            appName: "TestApp",
            ordNamespace: "sap.test",
            packageName: "TestPackage",
            env: {},
            hasSAPPolicyLevel: true,
        });

        expect(result).toBe("sap.test:package:TestApp-integrationDependency:v1");
    });

    it("appends visibility suffix to package id when hasSAPPolicyLevel and non-public visibility", () => {
        const result = RESOLVERS.partOfPackage({
            appName: "TestApp",
            ordNamespace: "sap.test",
            packageName: "TestPackage",
            hasSAPPolicyLevel: true,
            env: { integrationDependency: { visibility: RESOURCE_VISIBILITY.internal } },
        });

        expect(result).toBe("sap.test:package:TestApp-integrationDependency-internal:v1");
    });

    it("strips non-alphanumeric characters from appName", () => {
        const result = RESOLVERS.partOfPackage({
            appName: "My App-Name!",
            ordNamespace: "sap.test",
            packageName: "TestPackage",
            env: {},
            hasSAPPolicyLevel: true,
        });

        expect(result).toBe("sap.test:package:MyAppName-integrationDependency:v1");
    });

    it("prefers env.integrationDependency.partOfPackage when set", () => {
        const result = RESOLVERS.partOfPackage({
            appName: "TestApp",
            ordNamespace: "sap.test",
            packageName: "TestPackage",
            hasSAPPolicyLevel: true,
            env: { integrationDependency: { partOfPackage: "sap.test:package:custom:v1" } },
        });

        expect(result).toBe("sap.test:package:custom:v1");
    });
});

describe("RESOLVERS.aspects", () => {
    it("returns an empty array when no external services", () => {
        const result = RESOLVERS.aspects({ csn: cds.linked("service OrdersService {};") });

        expect(result).toEqual([]);
    });

    it("builds one aspect per external service", () => {
        const result = RESOLVERS.aspects({
            csn: cds.linked(`
                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:Orders:v2'
                service OrdersService {};
            `),
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            title: "OrdersService",
            mandatory: false,
            apiResources: [{ ordId: "sap.ext:apiResource:Orders:v2", minVersion: "2.0.0" }],
        });
    });

    it("derives minVersion from the last colon-separated segment of the ordId", () => {
        const result = RESOLVERS.aspects({
            csn: cds.linked(`
                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:ProductsService:v3'
                service ProductsService {};
            `),
        });

        expect(result).toHaveLength(1);
        expect(result[0].apiResources).toHaveLength(1);
        expect(result[0].apiResources[0].minVersion).toBe("3.0.0");
    });

    it("falls back to minVersion '1.0.0' when the ordId has no version segment", () => {
        const result = RESOLVERS.aspects({
            csn: cds.linked(`
                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:Things'
                service ThingsService {};
            `),
        });

        expect(result).toHaveLength(1);
        expect(result[0].apiResources[0].minVersion).toBe("1.0.0");
    });

    it("builds aspects for multiple external services", () => {
        const result = RESOLVERS.aspects({
            csn: cds.linked(`
                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:Orders:v1'
                service OrdersService {};

                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:Products:v2'
                service ProductsService {};
            `),
        });

        expect(result).toHaveLength(2);
        expect(result.map((a) => a.title)).toEqual(["OrdersService", "ProductsService"]);
    });

    it("merges @ORD.Extensions annotations onto the aspect", () => {
        const result = RESOLVERS.aspects({
            csn: cds.linked(`
                @cds.external
                @data.product
                @ORD.Extensions.mandatory: true
                @cds.dp.ordId: 'sap.ext:apiResource:Orders:v1'
                service OrdersService {};
            `),
        });

        expect(result).toHaveLength(1);
        expect(result[0].mandatory).toBe(true);
    });
});

describe("createIntegrationDependency", () => {
    it("produces a complete integration dependency object with defaults", () => {
        const result = createIntegrationDependency({
            env: {},
            appName: "TestApp",
            ordNamespace: "sap.test",
            packageName: "TestPackage",
            csn: cds.linked(`
                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:Orders:v1'
                service OrdersService {};
            `),
        });

        expect(result).toEqual({
            mandatory: false,
            version: "1.0.0",
            releaseStatus: "active",
            title: "External Dependencies",
            visibility: RESOURCE_VISIBILITY.public,
            partOfPackage: "sap.test:package:TestApp:v1",
            ordId: "sap.test:integrationDependency:externalDependencies:v1",
            aspects: [
                {
                    mandatory: false,
                    title: "OrdersService",
                    apiResources: [{ ordId: "sap.ext:apiResource:Orders:v1", minVersion: "1.0.0" }],
                },
            ],
        });
    });

    it("merges env.integrationDependency properties onto the result", () => {
        const result = createIntegrationDependency({
            appName: "TestApp",
            ordNamespace: "sap.test",
            packageName: "TestPackage",
            env: { integrationDependency: { releaseStatus: "beta", version: "2.0.0" } },
            csn: cds.linked(`
                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:Orders:v1'
                service OrdersService {};
            `),
        });

        expect(result.version).toBe("2.0.0");
        expect(result.releaseStatus).toBe("beta");
        expect(result.ordId).toBe("sap.test:integrationDependency:externalDependencies:v2");
    });

    it("should create a single IntegrationDependency with correct structure", () => {
        const result = createIntegrationDependency({
            env: {},
            appName: "testapp",
            hasSAPPolicyLevel: true,
            packageName: "TestPackage",
            ordNamespace: "customer.testapp",
            csn: cds.linked(`
                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:Supplier:v1'
                service sap.sai.Supplier.v1 {};
            `),
        });

        expect(result.ordId).toBe("customer.testapp:integrationDependency:externalDependencies:v1");
        expect(result.title).toBe("External Dependencies");
        expect(result.version).toBe("1.0.0");
        expect(result.releaseStatus).toBe("active");
        expect(result.visibility).toBe(RESOURCE_VISIBILITY.public);
        expect(result.mandatory).toBe(false);
        expect(result.partOfPackage).toBe("customer.testapp:package:testapp-integrationDependency:v1");
    });

    it("should create one aspect per external service", () => {
        const result = createIntegrationDependency({
            env: {},
            appName: "testapp",
            packageName: "TestPackage",
            ordNamespace: "customer.testapp",
            csn: cds.linked(`
                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.sai:apiResource:Supplier:v1'
                service sap.sai.Supplier.v1 {};

                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.sai:apiResource:Invoice:v1'
                service sap.sai.Invoice.v1 {};
            `),
        });

        expect(result.aspects).toHaveLength(2);
        expect(result.aspects[0].title).toBe("sap.sai.Supplier.v1");
        expect(result.aspects[0].mandatory).toBe(false);
        expect(result.aspects[0].apiResources).toEqual([
            { ordId: "sap.sai:apiResource:Supplier:v1", minVersion: "1.0.0" },
        ]);
        expect(result.aspects[1].title).toBe("sap.sai.Invoice.v1");
    });

    it("should apply @ORD.Extensions from service definition to aspect", () => {
        const result = createIntegrationDependency({
            env: {},
            appName: "testapp",
            packageName: "TestPackage",
            ordNamespace: "customer.testapp",
            csn: cds.linked(`
                @cds.external
                @data.product
                @ORD.Extensions.mandatory: false
                @ORD.Extensions.title: 'Custom Supplier API'
                @ORD.Extensions.description: 'Custom description'
                @cds.dp.ordId: 'sap.ext:apiResource:Supplier:v1'
                service sap.sai.Supplier.v1 {};
            `),
        });

        expect(result.aspects[0].title).toBe("Custom Supplier API");
        expect(result.aspects[0].mandatory).toBe(false);
        expect(result.aspects[0].description).toBe("Custom description");
    });

    it("should apply integrationDependency config from cdsrc", () => {
        const result = createIntegrationDependency({
            appName: "testapp",
            packageName: "TestPackage",
            ordNamespace: "customer.testapp",
            env: {
                integrationDependency: {
                    title: "Custom Integration Title",
                    mandatory: true,
                },
            },
            csn: cds.linked(`
                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:Supplier:v1'
                service sap.sai.Supplier.v1 {};
            `),
        });

        expect(result.mandatory).toBe(true);
        expect(result.title).toBe("Custom Integration Title");
    });

    it("should allow cdsrc to override version and releaseStatus", () => {
        const result = createIntegrationDependency({
            appName: "testapp",
            packageName: "TestPackage",
            ordNamespace: "customer.testapp",
            env: {
                integrationDependency: {
                    version: "2.0.0",
                    releaseStatus: "beta",
                },
            },
            csn: cds.linked(`
                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:Supplier:v1'
                service sap.sai.Supplier.v1 {};
            `),
        });

        expect(result.version).toBe("2.0.0");
        expect(result.releaseStatus).toBe("beta");
    });

    it("should allow cdsrc to override visibility and add description", () => {
        const result = createIntegrationDependency({
            appName: "testapp",
            packageName: "TestPackage",
            ordNamespace: "customer.testapp",
            env: {
                integrationDependency: {
                    visibility: RESOURCE_VISIBILITY.internal,
                    shortDescription: "Custom short description",
                    description: "Custom integration dependency description",
                },
            },
            csn: cds.linked(`
                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:Supplier:v1'
                service sap.sai.Supplier.v1 {};
            `),
        });

        expect(result.visibility).toBe(RESOURCE_VISIBILITY.internal);
        expect(result.description).toBe("Custom integration dependency description");
        expect(result.shortDescription).toBe("Custom short description");
    });
});

describe("createIntegrationDependencies", () => {
    const BASE_CONFIG = {
        appName: "TestApp",
        ordNamespace: "sap.test",
        packageName: "TestPackage",
        env: {},
    };

    it("returns an empty array when there are no external data product services", () => {
        const appConfig = {
            ...BASE_CONFIG,
            csn: cds.linked(`service OrdersService { entity Orders { key ID: UUID; } };`),
        };

        expect(createIntegrationDependencies(appConfig)).toEqual([]);
    });

    it("returns an empty array when the CSN has no definitions at all", () => {
        const appConfig = { ...BASE_CONFIG, csn: { definitions: {} } };

        expect(createIntegrationDependencies(appConfig)).toEqual([]);
    });

    it("returns one integration dependency when at least one external data product exists", () => {
        const appConfig = {
            ...BASE_CONFIG,
            csn: cds.linked(`
                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:Orders:v1'
                service OrdersService {};
            `),
        };

        const result = createIntegrationDependencies(appConfig);

        expect(result).toHaveLength(1);
        expect(result[0].ordId).toBe("sap.test:integrationDependency:externalDependencies:v1");
    });

    it("the single returned dependency contains one aspect per external service", () => {
        const appConfig = {
            ...BASE_CONFIG,
            csn: cds.linked(`
                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:Orders:v1'
                service OrdersService {};

                @cds.external
                @data.product
                @cds.dp.ordId: 'sap.ext:apiResource:Products:v2'
                service ProductsService {};
            `),
        };

        const result = createIntegrationDependencies(appConfig);

        expect(result).toHaveLength(1);
        expect(result[0].aspects).toHaveLength(2);
        const titles = result[0].aspects.map((a) => a.title);
        expect(titles).toContain("OrdersService");
        expect(titles).toContain("ProductsService");
    });

    it("never returns more than one integration dependency regardless of how many external services exist", () => {
        const appConfig = {
            ...BASE_CONFIG,
            csn: cds.linked(`
                @cds.external @data.product @cds.dp.ordId: 'sap.ext:apiResource:A:v1' service SvcA {};
                @cds.external @data.product @cds.dp.ordId: 'sap.ext:apiResource:B:v1' service SvcB {};
                @cds.external @data.product @cds.dp.ordId: 'sap.ext:apiResource:C:v1' service SvcC {};
            `),
        };

        expect(createIntegrationDependencies(appConfig)).toHaveLength(1);
    });

    it("ignores non-external regular services when deciding whether to return a dependency", () => {
        const appConfig = {
            ...BASE_CONFIG,
            csn: cds.linked(`
                service InternalService { entity Books { key ID: UUID; } }
            `),
        };

        expect(createIntegrationDependencies(appConfig)).toEqual([]);
    });
});
