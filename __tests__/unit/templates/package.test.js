const { createPackages, createPackage } = require("../../../lib/templates/package");
const { ORD_RESOURCE_TYPE, RESOURCE_VISIBILITY } = require("../../../lib/constants");

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

    it("should not contain partOfProducts if no productsOrdId found", () => {
        expect(
            createPackages({
                appName: "My Package",
                ordNamespace: "customer.sample",
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
                productOrdId: "sap:product:MyProduct:",
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
    });
});
