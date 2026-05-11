const { createProducts, createPackages, createConsumptionBundles } = require("../../../lib/model/package");

describe("package", () => {
    describe("createProducts", () => {
        test("creates default product from package name", () => {
            const config = { packageName: "test-app", env: {} };
            const products = createProducts(config);
            expect(products).toHaveLength(1);
            expect(products[0].ordId).toBeDefined();
        });

        test("merges custom product from env", () => {
            const config = {
                packageName: "test-app",
                env: { products: [{ title: "Custom Product" }] },
            };
            const products = createProducts(config);
            expect(products[0].title).toBe("Custom Product");
        });

        test("rejects SAP product ordId for custom products", () => {
            const config = {
                packageName: "test-app",
                env: { products: [{ ordId: "sap:product:forbidden:v1" }] },
            };
            const products = createProducts(config);
            expect(products[0].ordId).not.toContain("sap:product:forbidden");
        });
    });

    describe("createPackages", () => {
        test("creates packages with policy level information", () => {
            const config = {
                packageName: "test-app",
                ordNamespace: "customer.test",
                appName: "test-app",
                policyLevels: ["none"],
                env: {},
            };
            const products = [{ ordId: "customer.test:product:test:v1" }];
            const packages = createPackages(config, products);
            expect(packages.length).toBeGreaterThan(0);
            packages.forEach((pkg) => {
                expect(pkg.ordId).toBeDefined();
            });
        });
    });

    describe("createConsumptionBundles", () => {
        test("returns custom bundles from env when provided", () => {
            const customBundles = [{ ordId: "custom:bundle:v1" }];
            const config = { env: { consumptionBundles: customBundles } };
            expect(createConsumptionBundles(config)).toEqual(customBundles);
        });

        test("falls back to defaults when no env bundles", () => {
            const config = { ordNamespace: "customer.test", env: {} };
            const bundles = createConsumptionBundles(config);
            expect(bundles).toBeDefined();
        });
    });
});
