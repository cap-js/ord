const Logger = require("../../../lib/logger");
const { createProducts, createProduct, RESOLVERS } = require("../../../lib/templates/product");

describe("RESOLVERS", () => {
    describe("ordId", () => {
        it("returns default ordId derived from packageName when no override", () => {
            const result = RESOLVERS.ordId(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                {},
            );

            expect(result).toBe("customer:product:MyPackage:");
        });

        it("joins segments with dots, splitting on any non-alphanumeric character", () => {
            const result = RESOLVERS.ordId({ ordNamespace: "sap.test", packageName: "my-app name" }, {});

            expect(result).toBe("customer:product:my.app.name:");
        });

        it("drops leading/trailing separators from packageName", () => {
            const result = RESOLVERS.ordId({ ordNamespace: "sap.test", packageName: "-MyPackage-" }, {});

            expect(result).toBe("customer:product:MyPackage:");
        });

        it("uses override ordId verbatim when provided", () => {
            const result = RESOLVERS.ordId(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                { ordId: "customer:product:Custom:" },
            );

            expect(result).toBe("customer:product:Custom:");
        });

        it("replaces {namespace} placeholder in override ordId", () => {
            const result = RESOLVERS.ordId(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                { ordId: "{namespace}:product:A:" },
            );

            expect(result).toBe("sap.test:product:A:");
        });

        it("replaces {type} placeholder in override ordId", () => {
            const result = RESOLVERS.ordId(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                { ordId: "customer:{type}:A:" },
            );

            expect(result).toBe("customer:product:A:");
        });

        it("replaces both {namespace} and {type} placeholders in override ordId", () => {
            const result = RESOLVERS.ordId(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                { ordId: "{namespace}:{type}:A:" },
            );

            expect(result).toBe("sap.test:product:A:");
        });

        it("falls back to default when override ordId is undefined", () => {
            const result = RESOLVERS.ordId(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                { ordId: undefined },
            );

            expect(result).toBe("customer:product:MyPackage:");
        });

        it("falls back to default when overrides is undefined", () => {
            const result = RESOLVERS.ordId(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                undefined,
            );

            expect(result).toBe("customer:product:MyPackage:");
        });
    });

    describe("title", () => {
        it("returns packageName with non-alphanumeric chars replaced by spaces", () => {
            const result = RESOLVERS.title(
                {
                    packageName: "my-app.name",
                    ordNamespace: "sap.test",
                },
                {},
            );

            expect(result).toBe("my app name");
        });

        it("trims leading/trailing spaces produced by replacement", () => {
            const result = RESOLVERS.title(
                {
                    packageName: "-MyPackage-",
                    ordNamespace: "sap.test",
                },
                {},
            );

            expect(result).toBe("MyPackage");
        });

        it("uses override title verbatim when provided", () => {
            const result = RESOLVERS.title(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                { title: "Custom Title" },
            );

            expect(result).toBe("Custom Title");
        });

        it("falls back to derived title when override title is undefined", () => {
            const result = RESOLVERS.title(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                { title: undefined },
            );

            expect(result).toBe("MyPackage");
        });

        it("falls back to derived title when overrides is undefined", () => {
            const result = RESOLVERS.title(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                undefined,
            );

            expect(result).toBe("MyPackage");
        });
    });

    describe("vendor", () => {
        it("returns default vendor when no override", () => {
            const result = RESOLVERS.vendor(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                {},
            );

            expect(result).toBe("customer:vendor:Customer:");
        });

        it("uses override vendor verbatim when provided", () => {
            const result = RESOLVERS.vendor(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                { vendor: "sap:vendor:SAP:" },
            );

            expect(result).toBe("sap:vendor:SAP:");
        });

        it("falls back to default when override vendor is undefined", () => {
            const result = RESOLVERS.vendor(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                { vendor: undefined },
            );

            expect(result).toBe("customer:vendor:Customer:");
        });

        it("falls back to default when overrides is undefined", () => {
            const result = RESOLVERS.vendor(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                undefined,
            );

            expect(result).toBe("customer:vendor:Customer:");
        });
    });

    describe("shortDescription", () => {
        it("returns a sentence containing the resolved title when no override", () => {
            const result = RESOLVERS.shortDescription(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                {},
            );

            expect(result).toBe("Short description of MyPackage");
        });

        it("incorporates the override title into the default short description", () => {
            const result = RESOLVERS.shortDescription(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                { title: "My App" },
            );

            expect(result).toBe("Short description of My App");
        });

        it("uses override shortDescription verbatim when provided", () => {
            const result = RESOLVERS.shortDescription(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                { shortDescription: "Custom desc" },
            );

            expect(result).toBe("Custom desc");
        });

        it("falls back to derived short description when override shortDescription is undefined", () => {
            const result = RESOLVERS.shortDescription(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                { shortDescription: undefined },
            );

            expect(result).toBe("Short description of MyPackage");
        });

        it("falls back to derived short description when overrides is undefined", () => {
            const result = RESOLVERS.shortDescription(
                {
                    packageName: "MyPackage",
                    ordNamespace: "sap.test",
                },
                undefined,
            );

            expect(result).toBe("Short description of MyPackage");
        });
    });
});

describe("createProduct", () => {
    let errorSpy;

    beforeEach(() => {
        errorSpy = jest.spyOn(Logger, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        errorSpy.mockRestore();
    });

    it("produces a complete product object with defaults", () => {
        const result = createProduct({ packageName: "MyPackage", ordNamespace: "sap.test" });

        expect(result).toEqual({
            title: "MyPackage",
            vendor: "customer:vendor:Customer:",
            shortDescription: "Short description of MyPackage",
            ordId: "customer:product:MyPackage:",
        });
    });

    it("converts non-alphanumeric characters in packageName to spaces for title", () => {
        const result = createProduct({
            ordNamespace: "sap.test",
            packageName: "my-package.name",
        });

        expect(result.title).toBe("my package name");
    });

    it("joins title words with dots for the ordId", () => {
        const result = createProduct({
            ordNamespace: "sap.test",
            packageName: "my-package name",
        });

        expect(result.ordId).toBe("customer:product:my.package.name:");
    });

    it("trims leading/trailing non-alphanumeric characters from the name", () => {
        const result = createProduct({
            ordNamespace: "sap.test",
            packageName: "-MyPackage-",
        });

        expect(result.title).toBe("MyPackage");
        expect(result.ordId).toBe("customer:product:MyPackage:");
    });

    describe("env.products overrides", () => {
        it("merges env.products[0] onto the result", () => {
            const result = createProduct({
                packageName: "MyPackage",
                ordNamespace: "sap.test",
                env: { products: [{ vendor: "sap:vendor:SAP:", shortDescription: "Custom desc" }] },
            });

            expect(result.vendor).toBe("sap:vendor:SAP:");
            expect(result.shortDescription).toBe("Custom desc");
        });

        it("override can replace the ordId", () => {
            const result = createProduct({
                packageName: "MyPackage",
                ordNamespace: "sap.test",
                env: { products: [{ ordId: "customer:product:CustomProduct:" }] },
            });

            expect(result.ordId).toBe("customer:product:CustomProduct:");
        });

        it("ignores overrides and logs an error when ordId starts with 'sap' (case-insensitive)", () => {
            const result = createProduct({
                packageName: "MyPackage",
                ordNamespace: "sap.test",
                env: { products: [{ ordId: "SAP:product:SomeProduct:", vendor: "sap:vendor:SAP:" }] },
            });

            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(result.ordId).toBe("customer:product:MyPackage:");
            expect(result.vendor).toBe("customer:vendor:Customer:");
        });

        it("does not apply overrides when env.products is absent", () => {
            const result = createProduct({ packageName: "MyPackage", ordNamespace: "sap.test" });

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
        const result = createProducts({ packageName: "MyPackage", ordNamespace: "sap.test" });

        expect(result).toHaveLength(1);
        expect(result[0].ordId).toBe("customer:product:MyPackage:");
    });

    it("returns an empty array when existingProductORDId is set", () => {
        const result = createProducts({
            packageName: "MyPackage",
            ordNamespace: "sap.test",
            existingProductORDId: "sap:product:SAPServiceCloudV2:",
        });

        expect(result).toEqual([]);
    });

    it("returns an empty array when existingProductORDId is an empty string (falsy)", () => {
        const result = createProducts({ packageName: "MyPackage", ordNamespace: "sap.test", existingProductORDId: "" });

        expect(result).toHaveLength(1);
    });

    it("the returned product reflects the packageName", () => {
        const result = createProducts({ ordNamespace: "sap.test", packageName: "my-app" });

        expect(result[0].title).toBe("my app");
        expect(result[0].ordId).toBe("customer:product:my.app:");
    });

    it("never returns more than one product regardless of env.products length", () => {
        const result = createProducts({
            packageName: "MyPackage",
            ordNamespace: "sap.test",
            env: {
                products: [{ ordId: "customer:product:A:" }, { ordId: "customer:product:B:" }],
            },
        });

        expect(result).toHaveLength(1);
    });

    it("correctly replaces placeholders for namespace and type in product ordId", () => {
        const result = createProducts({
            packageName: "MyPackage",
            ordNamespace: "sap.test",
            env: {
                products: [{ ordId: "{namespace}:{type}:A:" }],
            },
        });

        expect(result).toMatchSnapshot();
    });
});
