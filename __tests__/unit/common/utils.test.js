const {
    getRFC3339Date,
    resolveVisibility,
    resolveServiceName,
    flattenEntityGraph,
    readORDExtensions,
    resolveAccessStrategies,
    isPrimaryDataProductService,
    isBlockedServiceName,
} = require("../../../lib/common/utils");
const { RESOURCE_VISIBILITY, ORD_ACCESS_STRATEGY } = require("../../../lib/constants");
const Logger = require("../../../lib/logger");
const cds = require("@sap/cds");

const RFC3339_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

describe("isPrimaryDataProductService", () => {
    it("returns true for @DataIntegration.dataProduct.type: 'primary'", () => {
        const serviceDefinition = { "@DataIntegration.dataProduct.type": "primary" };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
    });

    it("returns false for @DataIntegration.dataProduct.type: 'secondary'", () => {
        const serviceDefinition = { "@DataIntegration.dataProduct.type": "secondary" };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(false);
    });

    it("returns true for @data.product with truthy value", () => {
        const serviceDefinition = { "@data.product": true };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
    });

    it("returns true for @data.product with any truthy value", () => {
        const serviceDefinition = { "@data.product": "yes" };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
    });

    it("returns false for @data.product with falsy value", () => {
        const serviceDefinition = { "@data.product": false };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(false);
    });

    it("returns false for service with no data product annotations", () => {
        const serviceDefinition = { "@title": "Regular Service" };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(false);
    });

    it("returns true when both annotations are present - @DataIntegration.dataProduct.type takes precedence", () => {
        const serviceDefinition = {
            "@DataIntegration.dataProduct.type": "primary",
            "@data.product": false,
        };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
    });

    it("returns true when both annotations are present with @data.product truthy", () => {
        const serviceDefinition = {
            "@DataIntegration.dataProduct.type": "secondary",
            "@data.product": true,
        };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
    });

    it("returns false when both annotations are present with falsy values", () => {
        const serviceDefinition = {
            "@DataIntegration.dataProduct.type": "secondary",
            "@data.product": false,
        };
        expect(isPrimaryDataProductService(serviceDefinition)).toBe(false);
    });
});

describe("date", () => {
    it("tests getRFC3339Date with offset", () => {
        const lastUpdate = getRFC3339Date();
        expect(lastUpdate).toMatch(RFC3339_REGEX);
    });

    it("test regex correctly", () => {
        let lastUpdate = "1985-04-12T23:20:50.52Z";
        expect(lastUpdate).toMatch(RFC3339_REGEX);

        lastUpdate = "2022-12-19T15:47:04+00:00";
        expect(lastUpdate).toMatch(RFC3339_REGEX);

        lastUpdate = "1996-12-19T16:39:57-08:00";
        expect(lastUpdate).toMatch(RFC3339_REGEX);

        lastUpdate = "1937-01-01T12:00:27.87+00:20";
        expect(lastUpdate).toMatch(RFC3339_REGEX);
    });
});

describe("resolveVisibility", () => {
    const BASE_APP_CONFIG = { env: { defaultVisibility: RESOURCE_VISIBILITY.public } };

    it("returns public by default", () => {
        expect(resolveVisibility(BASE_APP_CONFIG, {})).toBe(RESOURCE_VISIBILITY.public);
    });

    it("returns public when appConfig.env is absent", () => {
        expect(resolveVisibility({}, {})).toBe(RESOURCE_VISIBILITY.public);
    });

    it("uses appConfig.env.defaultVisibility when no service override", () => {
        const appConfig = { env: { defaultVisibility: RESOURCE_VISIBILITY.internal } };
        expect(resolveVisibility(appConfig, {})).toBe(RESOURCE_VISIBILITY.internal);
    });

    it("returns internal for a primary data product regardless of default", () => {
        const service = { "@DataIntegration.dataProduct.type": "primary" };
        const appConfig = { env: { defaultVisibility: RESOURCE_VISIBILITY.public } };
        expect(resolveVisibility(appConfig, service)).toBe(RESOURCE_VISIBILITY.internal);
    });

    it("prefers @ORD.Extensions.visibility over defaultVisibility", () => {
        const service = { "@ORD.Extensions.visibility": RESOURCE_VISIBILITY.private };
        expect(resolveVisibility(BASE_APP_CONFIG, service)).toBe(RESOURCE_VISIBILITY.private);
    });

    it("returns public when @ORD.Extensions.implementationStandard is a supported ORD document standard", () => {
        const service = { "@ORD.Extensions.implementationStandard": "sap:ord-document-api:v1" };
        const appConfig = { env: { defaultVisibility: RESOURCE_VISIBILITY.internal } };
        expect(resolveVisibility(appConfig, service)).toBe(RESOURCE_VISIBILITY.public);
    });

    it("warns and falls back to public when defaultVisibility is unsupported", () => {
        const warnSpy = jest.spyOn(Logger, "warn").mockImplementation(() => {});
        const appConfig = { env: { defaultVisibility: "unsupported" } };
        expect(resolveVisibility(appConfig, {})).toBe(RESOURCE_VISIBILITY.public);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("primary data product visibility takes precedence over @ORD.Extensions.visibility", () => {
        const service = {
            "@DataIntegration.dataProduct.type": "primary",
            "@ORD.Extensions.visibility": RESOURCE_VISIBILITY.public,
        };
        expect(resolveVisibility(BASE_APP_CONFIG, service)).toBe(RESOURCE_VISIBILITY.internal);
    });
});

describe("resolveServiceName", () => {
    it("returns the name unchanged when it matches no namespace", () => {
        const appConfig = { ordNamespace: "sap.test" };
        expect(resolveServiceName(appConfig, { name: "com.other.MyService" })).toBe("com.other.MyService");
    });

    it("strips ordNamespace prefix from service name", () => {
        const appConfig = { ordNamespace: "sap.test" };
        expect(resolveServiceName(appConfig, { name: "sap.test.MyService" })).toBe("MyService");
    });

    it("returns empty string when name equals the namespace exactly", () => {
        const appConfig = { ordNamespace: "sap.test" };
        expect(resolveServiceName(appConfig, { name: "sap.test" })).toBe("");
    });

    it("prefers internalNamespace over ordNamespace when both match", () => {
        const appConfig = { internalNamespace: "sap.internal", ordNamespace: "sap" };
        expect(resolveServiceName(appConfig, { name: "sap.internal.MyService" })).toBe("MyService");
    });

    it("falls back to ordNamespace when internalNamespace does not match", () => {
        const appConfig = { internalNamespace: "sap.internal", ordNamespace: "sap.test" };
        expect(resolveServiceName(appConfig, { name: "sap.test.MyService" })).toBe("MyService");
    });

    it("does not strip a partial namespace prefix", () => {
        const appConfig = { ordNamespace: "sap.test" };
        expect(resolveServiceName(appConfig, { name: "sap.testing.MyService" })).toBe("sap.testing.MyService");
    });
});

describe("flattenEntityGraph", () => {
    it("returns a single-element array for an entity with no associations", () => {
        const entity = { name: "Root" };
        expect(flattenEntityGraph(entity)).toEqual([entity]);
    });

    it("includes directly associated entities", () => {
        const child = { name: "Child" };
        const root = { name: "Root", associations: { toChild: { target: "Child", _target: child } } };
        const result = flattenEntityGraph(root);
        expect(result).toHaveLength(2);
        expect(result).toContain(root);
        expect(result).toContain(child);
    });

    it("flattens a multi-level association chain", () => {
        const grandchild = { name: "GrandChild" };
        const child = { name: "Child", associations: { toGrand: { target: "GrandChild", _target: grandchild } } };
        const root = { name: "Root", associations: { toChild: { target: "Child", _target: child } } };
        const result = flattenEntityGraph(root);
        expect(result).toHaveLength(3);
        expect(result).toContain(grandchild);
    });

    it("does not follow already-visited targets (cycle guard)", () => {
        const child = { name: "Child", associations: {} };
        const grandchild = { name: "GrandChild" };
        child.associations.toGrand = { target: "GrandChild", _target: grandchild };
        // back-edge to GrandChild — already in processed, must not be followed again
        grandchild.associations = { back: { target: "GrandChild", _target: grandchild } };
        const root = { name: "Root", associations: { toChild: { target: "Child", _target: child } } };
        const result = flattenEntityGraph(root);
        expect(result).toHaveLength(3);
        expect(result).toContain(root);
        expect(result).toContain(child);
        expect(result).toContain(grandchild);
    });
});

describe("readORDExtensions", () => {
    it("returns an empty object when no @ORD.Extensions keys are present", () => {
        expect(readORDExtensions({ "@title": "Test", "name": "svc" })).toEqual({});
    });

    it("extracts a single extension key", () => {
        expect(readORDExtensions({ "@ORD.Extensions.title": "My Title" })).toEqual({ title: "My Title" });
    });

    it("extracts multiple extension keys", () => {
        const model = {
            "@ORD.Extensions.title": "T",
            "@ORD.Extensions.version": "2.0.0",
            "@title": "ignored",
        };
        expect(readORDExtensions(model)).toEqual({ title: "T", version: "2.0.0" });
    });

    it("supports nested keys via lodash set", () => {
        const model = { "@ORD.Extensions.extensible.supported": "yes" };
        expect(readORDExtensions(model)).toEqual({ extensible: { supported: "yes" } });
    });

    it("respects a custom prefix", () => {
        const model = { "@Custom.foo": "bar", "@ORD.Extensions.ignored": "x" };
        expect(readORDExtensions(model, "@Custom.")).toEqual({ foo: "bar" });
    });
});

describe("isBlockedServiceName", () => {
    it("returns true for exact match 'cds.xt.MTXServices'", () => {
        expect(isBlockedServiceName("cds.xt.MTXServices")).toBe(true);
    });

    it("returns true for exact match 'MtxOrdProviderService'", () => {
        expect(isBlockedServiceName("MtxOrdProviderService")).toBe(true);
    });

    it("returns true for exact match 'OpenResourceDiscoveryService'", () => {
        expect(isBlockedServiceName("OpenResourceDiscoveryService")).toBe(true);
    });

    it("returns true when a blocked name appears as a substring", () => {
        expect(isBlockedServiceName("some.namespace.OpenResourceDiscoveryService")).toBe(true);
    });

    it("returns false for a regular service name", () => {
        expect(isBlockedServiceName("my.app.CatalogService")).toBe(false);
    });

    it("returns false for an empty string", () => {
        expect(isBlockedServiceName("")).toBe(false);
    });

    it("returns false for undefined", () => {
        expect(isBlockedServiceName(undefined)).toBe(false);
    });

    it("returns false for null", () => {
        expect(isBlockedServiceName(null)).toBe(false);
    });
});

describe("resolveAccessStrategies", () => {
    beforeEach(() => {
        // Reset CDS environment
        cds.env.ord = {};
    });

    it("should map Basic auth type to basic-auth strategy", () => {
        const strategies = resolveAccessStrategies({ accessStrategies: [ORD_ACCESS_STRATEGY.Basic] });

        expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Basic }]);
    });

    it("should map CF mTLS auth type to sap:cmp-mtls:v1 strategy", () => {
        const strategies = resolveAccessStrategies({ accessStrategies: [ORD_ACCESS_STRATEGY.CmpMtls] });

        expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.CmpMtls }]);
    });

    it("should map Open auth type to open strategy", () => {
        const strategies = resolveAccessStrategies({ accessStrategies: [ORD_ACCESS_STRATEGY.Open] });

        expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
    });

    it("should map multiple auth types correctly", () => {
        const strategies = resolveAccessStrategies({
            accessStrategies: [ORD_ACCESS_STRATEGY.Basic, ORD_ACCESS_STRATEGY.CmpMtls],
        });

        expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Basic }, { type: ORD_ACCESS_STRATEGY.CmpMtls }]);
    });

    it("should handle unknown auth types gracefully", () => {
        const strategies = resolveAccessStrategies({ accessStrategies: ["unknown-type"] });

        // Should fallback to open since no valid types found
        expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
    });

    it("should filter out unknown types and keep valid ones", () => {
        const strategies = resolveAccessStrategies({
            accessStrategies: ["unknown-type", ORD_ACCESS_STRATEGY.Basic, ORD_ACCESS_STRATEGY.CmpMtls],
        });

        expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Basic }, { type: ORD_ACCESS_STRATEGY.CmpMtls }]);
    });

    it("should handle missing config with non-strict fallback", () => {
        cds.env.ord = { strictAccessStrategies: false };

        const strategies = resolveAccessStrategies({ accessStrategies: undefined });

        expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
    });

    it("should throw on missing config when strict", () => {
        cds.env.ord = { strictAccessStrategies: true };

        expect(() => resolveAccessStrategies({ accessStrategies: undefined })).toThrow();
    });

    it("should throw when open is used with any other access strategy", () => {
        expect(() =>
            resolveAccessStrategies({ accessStrategies: [ORD_ACCESS_STRATEGY.Open, ORD_ACCESS_STRATEGY.Basic] }),
        ).toThrow();
    });
});
