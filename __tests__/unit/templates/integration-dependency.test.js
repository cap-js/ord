const cds = require("@sap/cds");

const { RESOURCE_VISIBILITY } = require("../../../lib/constants");
const { createIntegrationDependency, RESOLVERS } = require("../../../lib/templates/integration-dependency");

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
            env: {},
        });

        expect(result).toBe("sap.test:package:TestApp:v1");
    });

    it("resolves to the integrationDependency-specific package when hasSAPPolicyLevel is true", () => {
        const result = RESOLVERS.partOfPackage({
            appName: "TestApp",
            ordNamespace: "sap.test",
            env: {},
            hasSAPPolicyLevel: true,
        });

        expect(result).toBe("sap.test:package:TestApp-integrationDependency:v1");
    });

    it("appends visibility suffix to package id when hasSAPPolicyLevel and non-public visibility", () => {
        const result = RESOLVERS.partOfPackage({
            appName: "TestApp",
            ordNamespace: "sap.test",
            hasSAPPolicyLevel: true,
            env: { integrationDependency: { visibility: RESOURCE_VISIBILITY.internal } },
        });

        expect(result).toBe("sap.test:package:TestApp-integrationDependency-internal:v1");
    });

    it("strips non-alphanumeric characters from appName", () => {
        const result = RESOLVERS.partOfPackage({
            appName: "My App-Name!",
            ordNamespace: "sap.test",
            env: {},
            hasSAPPolicyLevel: true,
        });

        expect(result).toBe("sap.test:package:MyAppName-integrationDependency:v1");
    });

    it("prefers env.integrationDependency.partOfPackage when set", () => {
        const result = RESOLVERS.partOfPackage({
            appName: "TestApp",
            ordNamespace: "sap.test",
            hasSAPPolicyLevel: true,
            env: { integrationDependency: { partOfPackage: "sap.test:package:custom:v1" } },
        });

        expect(result).toBe("sap.test:package:custom:v1");
    });
});

describe("RESOLVERS.aspects", () => {
    it("returns an empty array when externalServiceNames is empty", () => {
        const result = RESOLVERS.aspects({ externalServiceNames: [] }, cds.linked("service OrdersService {};"));

        expect(result).toEqual([]);
    });

    it("builds one aspect per external service", () => {
        const result = RESOLVERS.aspects(
            { externalServiceNames: ["OrdersService"] },
            cds.linked(`
                @cds.dp.ordId: 'sap.ext:apiResource:Orders:v2'
                service OrdersService {};
            `),
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            title: "OrdersService",
            mandatory: false,
            apiResources: [{ ordId: "sap.ext:apiResource:Orders:v2", minVersion: "2.0.0" }],
        });
    });

    it("derives minVersion from the last colon-separated segment of the ordId", () => {
        const result = RESOLVERS.aspects(
            { externalServiceNames: ["ProductsService"] },
            cds.linked(`
                @cds.dp.ordId: 'sap.ext:apiResource:ProductsService:v3'
                service ProductsService {};
            `),
        );

        expect(result).toHaveLength(1);
        expect(result[0].apiResources).toHaveLength(1);
        expect(result[0].apiResources[0].minVersion).toBe("3.0.0");
    });

    it("falls back to minVersion '1.0.0' when the ordId has no version segment", () => {
        const result = RESOLVERS.aspects(
            { externalServiceNames: ["ThingsService"] },
            cds.linked(`
                @cds.dp.ordId: 'sap.ext:apiResource:Things'
                service ThingsService {};
            `),
        );

        expect(result).toHaveLength(1);
        expect(result[0].apiResources[0].minVersion).toBe("1.0.0");
    });

    it("builds aspects for multiple external services", () => {
        const result = RESOLVERS.aspects(
            { externalServiceNames: ["OrdersService", "ProductsService"] },
            cds.linked(`
                @cds.dp.ordId: 'sap.ext:apiResource:Orders:v1'
                service OrdersService {};

                @cds.dp.ordId: 'sap.ext:apiResource:Products:v2'
                service ProductsService {};
            `),
        );

        expect(result).toHaveLength(2);
        expect(result.map((a) => a.title)).toEqual(["OrdersService", "ProductsService"]);
    });

    it("merges @ORD.Extensions annotations onto the aspect", () => {
        const result = RESOLVERS.aspects(
            { externalServiceNames: ["OrdersService"] },
            cds.linked(`
                @ORD.Extensions.mandatory: true
                @cds.dp.ordId: 'sap.ext:apiResource:Orders:v1'
                service OrdersService {};
            `),
        );

        expect(result).toHaveLength(1);
        expect(result[0].mandatory).toBe(true);
    });
});

describe("createIntegrationDependency", () => {
    it("produces a complete integration dependency object with defaults", () => {
        const result = createIntegrationDependency(
            cds.linked(`
                @cds.dp.ordId: 'sap.ext:apiResource:Orders:v1'
                service OrdersService {};
            `),
            {
                env: {},
                appName: "TestApp",
                ordNamespace: "sap.test",
                externalServiceNames: ["OrdersService"],
            },
        );

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
        const result = createIntegrationDependency(
            cds.linked(`
                @cds.dp.ordId: 'sap.ext:apiResource:Orders:v1'
                service OrdersService {};
            `),
            {
                appName: "TestApp",
                ordNamespace: "sap.test",
                externalServiceNames: ["OrdersService"],
                env: { integrationDependency: { releaseStatus: "beta", version: "2.0.0" } },
            },
        );

        expect(result.version).toBe("2.0.0");
        expect(result.releaseStatus).toBe("beta");
        expect(result.ordId).toBe("sap.test:integrationDependency:externalDependencies:v2");
    });
});
