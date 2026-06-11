const { createPackages, createPackage, RESOLVERS } = require("../../../lib/templates/package");
const { ORD_RESOURCE_TYPE, RESOURCE_VISIBILITY } = require("../../../lib/constants");

describe("RESOLVERS", () => {
    describe("title", () => {
        it("returns default title derived from appName when no env override", () => {
            const result = RESOLVERS.title({
                appName: "MyApp",
                ordNamespace: "sap.test",
            });

            expect(result).toBe("MyApp");
        });

        it("replaces non-alphanumeric characters in appName with spaces and trims", () => {
            const result = RESOLVERS.title({
                appName: "-my-app.name-",
                ordNamespace: "sap.test",
            });

            expect(result).toBe("my app name");
        });

        it("uses env.packages[0].title when provided", () => {
            const result = RESOLVERS.title({
                appName: "MyApp",
                ordNamespace: "sap.test",
                env: { packages: [{ title: "Custom Title" }] },
            });

            expect(result).toBe("Custom Title");
        });

        it("falls back to default when env.packages[0].title is undefined", () => {
            const result = RESOLVERS.title({
                appName: "MyApp",
                ordNamespace: "sap.test",
                env: { packages: [{ title: undefined }] },
            });

            expect(result).toBe("MyApp");
        });
    });

    describe("vendor", () => {
        it("returns default vendor when no env override", () => {
            const result = RESOLVERS.vendor({
                appName: "MyApp",
                ordNamespace: "sap.test",
            });

            expect(result).toBe("customer:vendor:Customer:");
        });

        it("uses env.packages[0].vendor when provided", () => {
            const result = RESOLVERS.vendor({
                appName: "MyApp",
                ordNamespace: "sap.test",
                env: { packages: [{ vendor: "sap:vendor:SAP:" }] },
            });

            expect(result).toBe("sap:vendor:SAP:");
        });

        it("falls back to default when env.packages[0].vendor is undefined", () => {
            const result = RESOLVERS.vendor({
                appName: "MyApp",
                ordNamespace: "sap.test",
                env: { packages: [{ vendor: undefined }] },
            });

            expect(result).toBe("customer:vendor:Customer:");
        });
    });

    describe("version", () => {
        it("returns default version when no env override", () => {
            const result = RESOLVERS.version({
                appName: "MyApp",
                ordNamespace: "sap.test",
            });

            expect(result).toBe("1.0.0");
        });

        it("uses env.packages[0].version when provided", () => {
            const result = RESOLVERS.version({
                appName: "MyApp",
                ordNamespace: "sap.test",
                env: { packages: [{ version: "2.3.4" }] },
            });

            expect(result).toBe("2.3.4");
        });

        it("falls back to default when env.packages[0].version is undefined", () => {
            const result = RESOLVERS.version({
                appName: "MyApp",
                ordNamespace: "sap.test",
                env: { packages: [{ version: undefined }] },
            });

            expect(result).toBe("1.0.0");
        });
    });

    describe("partOfProducts", () => {
        it("returns the supplied products array when no env override", () => {
            const result = RESOLVERS.partOfProducts(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                },
                ["customer:product:MyApp:"],
            );

            expect(result).toEqual(["customer:product:MyApp:"]);
        });

        it("uses env.packages[0].partOfProducts when provided", () => {
            const result = RESOLVERS.partOfProducts(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                    env: { packages: [{ partOfProducts: ["sap:product:SomeProduct:"] }] },
                },
                ["customer:product:MyApp:"],
            );

            expect(result).toEqual(["sap:product:SomeProduct:"]);
        });

        it("falls back to supplied products when env.packages[0].partOfProducts is undefined", () => {
            const result = RESOLVERS.partOfProducts(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                    env: { packages: [{ partOfProducts: undefined }] },
                },
                ["customer:product:MyApp:"],
            );

            expect(result).toEqual(["customer:product:MyApp:"]);
        });
    });

    describe("description", () => {
        it("returns a default description containing visibility, label, and resolved title", () => {
            const result = RESOLVERS.description(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                },
                "General",
                RESOURCE_VISIBILITY.public,
            );

            expect(result).toBe("This package contains public General for MyApp.");
        });

        it("incorporates the resolved title into the default description", () => {
            const result = RESOLVERS.description(
                {
                    appName: "my-app",
                    ordNamespace: "sap.test",
                },
                "APIs",
                RESOURCE_VISIBILITY.internal,
            );

            expect(result).toBe("This package contains internal APIs for my app.");
        });

        it("uses env.packages[0].description when provided", () => {
            const result = RESOLVERS.description(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                    env: { packages: [{ description: "Custom description" }] },
                },
                "General",
                RESOURCE_VISIBILITY.public,
            );

            expect(result).toBe("Custom description");
        });

        it("falls back to default when env.packages[0].description is undefined", () => {
            const result = RESOLVERS.description(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                    env: { packages: [{ description: undefined }] },
                },
                "APIs",
                RESOURCE_VISIBILITY.private,
            );

            expect(result).toBe("This package contains private APIs for MyApp.");
        });
    });

    describe("shortDescription", () => {
        it("returns default short description containing visibility and label", () => {
            const result = RESOLVERS.shortDescription(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                },
                "General",
                RESOURCE_VISIBILITY.public,
            );

            expect(result).toBe("Package containing public General");
        });

        it("uses env.packages[0].shortDescription when provided", () => {
            const result = RESOLVERS.shortDescription(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                    env: { packages: [{ shortDescription: "Custom short desc" }] },
                },
                "General",
                RESOURCE_VISIBILITY.public,
            );

            expect(result).toBe("Custom short desc");
        });

        it("falls back to default when env.packages[0].shortDescription is undefined", () => {
            const result = RESOLVERS.shortDescription(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                    env: { packages: [{ shortDescription: undefined }] },
                },
                "APIs",
                RESOURCE_VISIBILITY.internal,
            );

            expect(result).toBe("Package containing internal APIs");
        });
    });

    describe("ordId", () => {
        it("returns default ordId with no resourceType tag and no visibility suffix for public", () => {
            const result = RESOLVERS.ordId(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                },
                "General",
                RESOURCE_VISIBILITY.public,
                undefined,
            );

            expect(result).toBe("sap.test:package:MyApp:v1");
        });

        it("appends resourceType tag when resourceType is provided", () => {
            const result = RESOLVERS.ordId(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                },
                "APIs",
                RESOURCE_VISIBILITY.public,
                "api",
            );

            expect(result).toBe("sap.test:package:MyApp-api:v1");
        });

        it("appends visibility suffix for non-public visibility", () => {
            const result = RESOLVERS.ordId(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                },
                "APIs",
                RESOURCE_VISIBILITY.internal,
                undefined,
            );

            expect(result).toBe("sap.test:package:MyApp-internal:v1");
        });

        it("appends both resourceType tag and visibility suffix together", () => {
            const result = RESOLVERS.ordId(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                },
                "APIs",
                RESOURCE_VISIBILITY.private,
                "api",
            );

            expect(result).toBe("sap.test:package:MyApp-api-private:v1");
        });

        it("strips non-alphanumeric characters from appName", () => {
            const result = RESOLVERS.ordId(
                {
                    appName: "my-app.name",
                    ordNamespace: "sap.test",
                },
                "General",
                RESOURCE_VISIBILITY.public,
                undefined,
            );

            expect(result).toBe("sap.test:package:myappname:v1");
        });

        it("uses env.packages[0].ordId verbatim when provided", () => {
            const result = RESOLVERS.ordId(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                    env: { packages: [{ ordId: "sap.test:package:Custom:v1" }] },
                },
                "General",
                RESOURCE_VISIBILITY.public,
                undefined,
            );

            expect(result).toBe("sap.test:package:Custom:v1");
        });

        it("replaces {namespace} placeholder in env.packages[0].ordId", () => {
            const result = RESOLVERS.ordId(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                    env: { packages: [{ ordId: "{namespace}:package:MyApp:v1" }] },
                },
                "General",
                RESOURCE_VISIBILITY.public,
                undefined,
            );

            expect(result).toBe("sap.test:package:MyApp:v1");
        });

        it("replaces {type} placeholder in env.packages[0].ordId", () => {
            const result = RESOLVERS.ordId(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                    env: { packages: [{ ordId: "sap.test:{type}:MyApp:v1" }] },
                },
                "General",
                RESOURCE_VISIBILITY.public,
                undefined,
            );

            expect(result).toBe("sap.test:package:MyApp:v1");
        });

        it("replaces both {namespace} and {type} placeholders in env.packages[0].ordId", () => {
            const result = RESOLVERS.ordId(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                    env: { packages: [{ ordId: "{namespace}:{type}:MyApp:v1" }] },
                },
                "General",
                RESOURCE_VISIBILITY.public,
                undefined,
            );

            expect(result).toBe("sap.test:package:MyApp:v1");
        });

        it("falls back to default when env.packages[0].ordId is undefined", () => {
            const result = RESOLVERS.ordId(
                {
                    appName: "MyApp",
                    ordNamespace: "sap.test",
                    env: { packages: [{ ordId: undefined }] },
                },
                "General",
                RESOURCE_VISIBILITY.public,
                undefined,
            );

            expect(result).toBe("sap.test:package:MyApp:v1");
        });
    });
});

describe("packages", () => {
    it("should return default value if policyLevels contains sap", () => {
        expect(
            createPackages({
                appName: "My Package",
                ordNamespace: "customer.sample",
                packageName: "TestPackage",
                policyLevels: ["sap:policy"],
                hasSAPPolicyLevel: true,
            }),
        ).toMatchSnapshot();
    });

    it("should return default value if policyLevels does not contain sap", () => {
        expect(
            createPackages({
                appName: "My Package",
                ordNamespace: "customer.sample",
                packageName: "TestPackage",
                policyLevels: ["policy"],
            }),
        ).toMatchSnapshot();
    });

    it("should return custom value if user defined in .cdsrc.json", () => {
        expect(
            createPackages({
                appName: "My Package",
                ordNamespace: "customer.sample",
                packageName: "eb.bm.tests",
                policyLevels: ["policy"],
                env: {
                    packages: [
                        {
                            vendor: "sap:vendor:SAP:",
                            tags: ["custom"],
                        },
                    ],
                },
            }),
        ).toMatchSnapshot();
    });

    it("should use existingProductId if provided in .cdsrc.json", () => {
        expect(
            createPackages({
                appName: "My Package",
                ordNamespace: "customer.sample",
                existingProductORDId: "sap:product:SAPServiceCloudV2:",
                policyLevels: ["policy"],
                packageName: "TestPackage",
            }),
        ).toMatchSnapshot();
    });

    it("should use existingProductId if existingProductId and custom product both provided in .cdsrc.json", () => {
        expect(
            createPackages({
                appName: "My Package",
                ordNamespace: "customer.sample",
                existingProductORDId: "sap:product:SAPServiceCloudV2:",
                policyLevels: ["policy"],
                packageName: "TestPackage",
                env: {
                    products: [
                        {
                            ordId: "customer:product:demo.product.id",
                        },
                    ],
                },
            }),
        ).toMatchSnapshot();
    });

    it("should use custom vendor if it defined in .cdsrc.json", () => {
        expect(
            createPackages({
                appName: "My Package",
                ordNamespace: "customer.sample",
                env: {
                    packages: [
                        {
                            vendor: "sap:vendor:SAP:",
                        },
                    ],
                },
                policyLevels: ["policy"],
                packageName: "TestPackage",
            }),
        ).toMatchSnapshot();
    });
});

describe("createPackage", () => {
    const BASE_CONFIG = {
        appName: "MyApp",
        ordNamespace: "sap.test",
        packageName: "TestPackage",
    };

    describe("ordId construction", () => {
        it("builds a public ordId with no resource type tag and no visibility suffix", () => {
            const result = createPackage(BASE_CONFIG, { label: "General", visibility: RESOURCE_VISIBILITY.public });
            expect(result.ordId).toBe("sap.test:package:MyApp:v1");
        });

        it("appends the resource type tag to the ordId", () => {
            const result = createPackage(BASE_CONFIG, {
                label: "APIs",
                visibility: RESOURCE_VISIBILITY.public,
                resourceType: ORD_RESOURCE_TYPE.api,
            });
            expect(result.ordId).toBe("sap.test:package:MyApp-api:v1");
        });

        it("appends the visibility suffix for non-public visibility", () => {
            const result = createPackage(BASE_CONFIG, { label: "APIs", visibility: RESOURCE_VISIBILITY.internal });
            expect(result.ordId).toBe("sap.test:package:MyApp-internal:v1");
        });

        it("appends both resource type tag and visibility suffix together", () => {
            const result = createPackage(BASE_CONFIG, {
                label: "APIs",
                visibility: RESOURCE_VISIBILITY.internal,
                resourceType: ORD_RESOURCE_TYPE.api,
            });
            expect(result.ordId).toBe("sap.test:package:MyApp-api-internal:v1");
        });

        it("strips non-alphanumeric characters from appName in the ordId", () => {
            const appConfig = { ...BASE_CONFIG, appName: "My App-Name!" };
            const result = createPackage(appConfig, { label: "General", visibility: RESOURCE_VISIBILITY.public });
            expect(result.ordId).toBe("sap.test:package:MyAppName:v1");
        });
    });

    describe("text fields", () => {
        it("uses the human-readable name (spaces preserved) as title", () => {
            const appConfig = { ...BASE_CONFIG, appName: "My-App Name" };
            const result = createPackage(appConfig, { label: "General", visibility: RESOURCE_VISIBILITY.public });
            expect(result.title).toBe("My App Name");
        });

        it("includes visibility and label in shortDescription and description", () => {
            const result = createPackage(BASE_CONFIG, {
                label: "APIs",
                visibility: RESOURCE_VISIBILITY.internal,
            });
            expect(result.shortDescription).toBe("Package containing internal APIs");
            expect(result.description).toBe("This package contains internal APIs for MyApp.");
        });

        it("always sets version to 1.0.0 and vendor to customer:vendor:Customer:", () => {
            const result = createPackage(BASE_CONFIG, { label: "General", visibility: RESOURCE_VISIBILITY.public });
            expect(result.version).toBe("1.0.0");
            expect(result.vendor).toBe("customer:vendor:Customer:");
        });
    });

    describe("partOfProducts", () => {
        it("includes partOfProducts when productOrdId is provided", () => {
            const result = createPackage(BASE_CONFIG, {
                label: "General",
                visibility: RESOURCE_VISIBILITY.public,
                products: ["sap:product:MyProduct:"],
            });
            expect(result.partOfProducts).toEqual(["sap:product:MyProduct:"]);
        });

        it("omits partOfProducts when productOrdId is not provided", () => {
            const result = createPackage(BASE_CONFIG, { label: "General", visibility: RESOURCE_VISIBILITY.public });
            expect(result).not.toHaveProperty("partOfProducts");
        });

        it("omits partOfProducts when productOrdId is an empty string", () => {
            const result = createPackage(BASE_CONFIG, {
                label: "General",
                visibility: RESOURCE_VISIBILITY.public,
                productOrdId: "",
            });
            expect(result).not.toHaveProperty("partOfProducts");
        });
    });

    describe("env.packages overrides", () => {
        it("merges env.packages[0] overrides onto the result", () => {
            const appConfig = {
                ...BASE_CONFIG,
                env: { packages: [{ vendor: "sap:vendor:SAP:", tags: ["custom"] }] },
            };
            const result = createPackage(appConfig, { label: "General", visibility: RESOURCE_VISIBILITY.public });
            expect(result.vendor).toBe("sap:vendor:SAP:");
            expect(result.tags).toEqual(["custom"]);
        });

        it("overrides can replace ordId", () => {
            const appConfig = {
                ...BASE_CONFIG,
                env: { packages: [{ ordId: "sap.test:package:custom-override:v1" }] },
            };
            const result = createPackage(appConfig, { label: "General", visibility: RESOURCE_VISIBILITY.public });
            expect(result.ordId).toBe("sap.test:package:custom-override:v1");
        });

        it("does not apply overrides when env.packages is absent", () => {
            const result = createPackage(BASE_CONFIG, { label: "General", visibility: RESOURCE_VISIBILITY.public });
            expect(result.vendor).toBe("customer:vendor:Customer:");
        });

        it("placeholders in overrides are replaced accordingly", () => {
            const appConfig = {
                ...BASE_CONFIG,
                env: { packages: [{ ordId: "{namespace}:{type}:custom-override:v1" }] },
            };
            const result = createPackages(appConfig);

            expect(result).toHaveLength(1);
            expect(result[0].ordId).toBe("sap.test:package:custom-override:v1");
        });
    });
});
