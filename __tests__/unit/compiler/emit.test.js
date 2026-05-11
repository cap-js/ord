const { emit } = require("../../../lib/compiler/emit");

describe("emit", () => {
    function buildResolvedDocument(overrides = {}) {
        return {
            config: {
                env: {},
                policyLevels: ["none"],
                packageName: "test-app",
                ordNamespace: "customer.test",
                ...overrides.config,
            },
            resolved: {
                products: [{ ordId: "customer.test:product:test:v1", title: "Test Product" }],
                packages: [{ ordId: "customer.test:package:test-api:v1" }],
                consumptionBundles: [{ ordId: "customer.test:consumptionBundle:v1" }],
                groups: [],
                apiResources: [],
                eventResources: [],
                entityTypes: [],
                integrationDependencies: [],
                ...overrides.resolved,
            },
            customOrd: overrides.customOrd || null,
            extensions: overrides.extensions || [],
        };
    }

    test("produces document with required top-level fields", () => {
        const result = emit(buildResolvedDocument());

        expect(result.$schema).toBeDefined();
        expect(result.openResourceDiscovery).toBeDefined();
        expect(result.policyLevels).toEqual(["none"]);
        expect(result.consumptionBundles).toBeDefined();
    });

    test("includes products when no existingProductORDId", () => {
        const result = emit(buildResolvedDocument());
        expect(result.products).toHaveLength(1);
    });

    test("omits products when existingProductORDId is set", () => {
        const result = emit(
            buildResolvedDocument({
                config: { env: { existingProductORDId: "sap:product:existing:v1" } },
            }),
        );
        expect(result.products).toBeUndefined();
    });

    test("includes apiResources only when non-empty", () => {
        const withApis = emit(
            buildResolvedDocument({
                resolved: {
                    apiResources: [
                        { ordId: "ns:apiResource:A:v1", partOfPackage: "customer.test:package:test-api:v1" },
                    ],
                },
            }),
        );
        const withoutApis = emit(buildResolvedDocument());

        expect(withApis.apiResources).toHaveLength(1);
        expect(withoutApis.apiResources).toBeUndefined();
    });

    test("includes eventResources only when non-empty", () => {
        const result = emit(
            buildResolvedDocument({
                resolved: {
                    eventResources: [
                        { ordId: "ns:eventResource:E:v1", partOfPackage: "customer.test:package:test-api:v1" },
                    ],
                },
            }),
        );
        expect(result.eventResources).toHaveLength(1);
    });

    test("includes groups only when non-empty", () => {
        const result = emit(buildResolvedDocument({ resolved: { groups: [{ groupId: "g1" }] } }));
        expect(result.groups).toHaveLength(1);
    });

    test("filters out unused packages", () => {
        const result = emit(
            buildResolvedDocument({
                resolved: {
                    packages: [
                        { ordId: "customer.test:package:used:v1" },
                        { ordId: "customer.test:package:unused:v1" },
                    ],
                    apiResources: [{ ordId: "ns:api:A:v1", partOfPackage: "customer.test:package:used:v1" }],
                },
            }),
        );
        expect(result.packages).toHaveLength(1);
        expect(result.packages[0].ordId).toBe("customer.test:package:used:v1");
    });

    test("applies custom ORD content (merges array properties)", () => {
        const customPackage = { ordId: "custom:package:injected:v1", title: "Injected" };
        const result = emit(
            buildResolvedDocument({
                resolved: {
                    apiResources: [{ ordId: "ns:api:A:v1", partOfPackage: "custom:package:injected:v1" }],
                },
                customOrd: { packages: [customPackage] },
            }),
        );
        expect(result.packages.some((p) => p.ordId === "custom:package:injected:v1")).toBe(true);
    });

    test("applies extensions in order (later extensions win)", () => {
        const ext1 = { packages: [{ ordId: "ext:package:first:v1" }] };
        const ext2 = { packages: [{ ordId: "ext:package:second:v1" }] };
        const result = emit(
            buildResolvedDocument({
                resolved: {
                    apiResources: [{ ordId: "ns:api:A:v1", partOfPackage: "ext:package:second:v1" }],
                },
                extensions: [ext1, ext2],
            }),
        );
        expect(result.packages.some((p) => p.ordId === "ext:package:second:v1")).toBe(true);
    });
});
