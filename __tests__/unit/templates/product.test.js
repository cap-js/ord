const Logger = require("../../../lib/logger");
const { createProducts, createProduct } = require("../../../lib/templates/product");

const BASE_CONFIG = {
    packageName: "MyPackage",
    ordNamespace: "sap.test",
};

describe("createProduct", () => {
    let errorSpy;

    beforeEach(() => {
        errorSpy = jest.spyOn(Logger, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        errorSpy.mockRestore();
    });

    it("produces a complete product object with defaults", () => {
        const result = createProduct(BASE_CONFIG);
        expect(result).toEqual({
            title: "MyPackage",
            vendor: "customer:vendor:Customer:",
            shortDescription: "Short description of MyPackage",
            ordId: "customer:product:MyPackage:",
        });
    });

    it("converts non-alphanumeric characters in packageName to spaces for title", () => {
        const result = createProduct({ ...BASE_CONFIG, packageName: "my-package.name" });
        expect(result.title).toBe("my package name");
    });

    it("joins title words with dots for the ordId", () => {
        const result = createProduct({ ...BASE_CONFIG, packageName: "my-package name" });
        expect(result.ordId).toBe("customer:product:my.package.name:");
    });

    it("trims leading/trailing non-alphanumeric characters from the name", () => {
        const result = createProduct({ ...BASE_CONFIG, packageName: "-MyPackage-" });
        expect(result.title).toBe("MyPackage");
        expect(result.ordId).toBe("customer:product:MyPackage:");
    });

    describe("env.products overrides", () => {
        it("merges env.products[0] onto the result", () => {
            const appConfig = {
                ...BASE_CONFIG,
                env: { products: [{ vendor: "sap:vendor:SAP:", shortDescription: "Custom desc" }] },
            };
            const result = createProduct(appConfig);
            expect(result.vendor).toBe("sap:vendor:SAP:");
            expect(result.shortDescription).toBe("Custom desc");
        });

        it("override can replace the ordId", () => {
            const appConfig = {
                ...BASE_CONFIG,
                env: { products: [{ ordId: "customer:product:CustomProduct:" }] },
            };
            const result = createProduct(appConfig);
            expect(result.ordId).toBe("customer:product:CustomProduct:");
        });

        it("ignores overrides and logs an error when ordId starts with 'sap' (case-insensitive)", () => {
            const appConfig = {
                ...BASE_CONFIG,
                env: { products: [{ ordId: "SAP:product:SomeProduct:", vendor: "sap:vendor:SAP:" }] },
            };
            const result = createProduct(appConfig);
            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(result.ordId).toBe("customer:product:MyPackage:");
            expect(result.vendor).toBe("customer:vendor:Customer:");
        });

        it("does not apply overrides when env.products is absent", () => {
            const result = createProduct(BASE_CONFIG);
            expect(result.vendor).toBe("customer:vendor:Customer:");
        });
    });
});

describe("createProducts", () => {
    let errorSpy;

    beforeEach(() => {
        errorSpy = jest.spyOn(Logger, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        errorSpy.mockRestore();
    });

    it("returns an array with one product when existingProductORDId is not set", () => {
        const result = createProducts(BASE_CONFIG);
        expect(result).toHaveLength(1);
        expect(result[0].ordId).toBe("customer:product:MyPackage:");
    });

    it("returns an empty array when existingProductORDId is set", () => {
        const appConfig = { ...BASE_CONFIG, existingProductORDId: "sap:product:SAPServiceCloudV2:" };
        expect(createProducts(appConfig)).toEqual([]);
    });

    it("returns an empty array when existingProductORDId is an empty string (falsy)", () => {
        const appConfig = { ...BASE_CONFIG, existingProductORDId: "" };
        const result = createProducts(appConfig);
        expect(result).toHaveLength(1);
    });

    it("the returned product reflects the packageName", () => {
        const appConfig = { ...BASE_CONFIG, packageName: "my-app" };
        const result = createProducts(appConfig);
        expect(result[0].title).toBe("my app");
        expect(result[0].ordId).toBe("customer:product:my.app:");
    });

    it("never returns more than one product regardless of env.products length", () => {
        const appConfig = {
            ...BASE_CONFIG,
            env: {
                products: [
                    { ordId: "customer:product:A:" },
                    { ordId: "customer:product:B:" },
                ],
            },
        };
        expect(createProducts(appConfig)).toHaveLength(1);
    });
});