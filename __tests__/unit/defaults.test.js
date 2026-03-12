const defaults = require("../../lib/defaults");
const { AUTHENTICATION_TYPE } = require("../../lib/constants");

describe("defaults", () => {
    describe("$schema", () => {
        it("should return default value", () => {
            expect(defaults.$schema).toMatchSnapshot();
        });
    });

    describe("openResourceDiscovery", () => {
        it("should return default value", () => {
            expect(defaults.openResourceDiscovery).toMatchSnapshot();
        });
    });

    describe("policyLevels", () => {
        it("should return default value", () => {
            expect(defaults.policyLevels).toMatchSnapshot();
        });
    });

    describe("description", () => {
        it("should return default value", () => {
            expect(defaults.description).toMatchSnapshot();
        });
    });

    describe("products", () => {
        const testProductsName = "My Product";
        it("should return default value", () => {
            expect(defaults.products(testProductsName)).toMatchSnapshot();
        });
    });

    describe("groupTypeId", () => {
        it("should return default value", () => {
            expect(defaults.groupTypeId).toMatchSnapshot();
        });
    });

    describe("packages", () => {
        const testGetPackageDataName = "My Package";
        const testGetPackageOrdNamespace = "customer.sample";
        var appConfig = {};
        it("should return default value if policyLevels contains sap", () => {
            appConfig = {
                appName: testGetPackageDataName,
                ordNamespace: testGetPackageOrdNamespace,
                policyLevels: ["sap:policy"],
            };
            expect(defaults.packages(appConfig)).toMatchSnapshot();
        });

        it("should return default value if policyLevels does not contain sap", () => {
            appConfig = {
                appName: testGetPackageDataName,
                ordNamespace: testGetPackageOrdNamespace,
                policyLevels: ["policy"],
            };
            expect(defaults.packages(appConfig)).toMatchSnapshot();
        });

        it("should return custom value if user defined in .cdsrc.json", () => {
            appConfig = {
                appName: testGetPackageDataName,
                ordNamespace: testGetPackageOrdNamespace,
                products: [
                    {
                        ordId: "customer:product:eb.bm.tests:",
                        vendor: "sap:vendor:SAP:",
                    },
                ],
                env: {
                    packages: [
                        {
                            vendor: "sap:vendor:SAP:",
                            tags: ["custom"],
                        },
                    ],
                },
                policyLevels: ["policy"],
            };
            expect(defaults.packages(appConfig)).toMatchSnapshot();
        });

        it("should return only custom value if user definitions in .cdsrc.json are done correctly", () => {
            appConfig = {
                appName: testGetPackageDataName,
                ordNamespace: testGetPackageOrdNamespace,
                products: [
                    {
                        ordId: "customer:product:eb.bm.tests:",
                        vendor: "sap:vendor:SAP:",
                    },
                ],
                env: {
                    packages: [
                        {
                            licenseType: "important license", // valid type
                            runtimeRestriction: 4, // incorrect type
                            industry: "Finance", // incorrect type
                            labels: ["correct"], // valid type
                            invalidKey: "should be removed", // invalid key
                        },
                    ],
                },
                policyLevels: ["policy"],
            };
            expect(defaults.packages(appConfig)).toMatchSnapshot();
        });

        it("should use existingProductId if provided in .cdsrc.json", () => {
            appConfig = {
                appName: testGetPackageDataName,
                ordNamespace: testGetPackageOrdNamespace,
                existingProductORDId: "sap:product:SAPServiceCloudV2:",
                policyLevels: ["policy"],
            };
            expect(defaults.packages(appConfig)).toMatchSnapshot();
        });

        it("should use existingProductId if existingProductId and custom product both provided in .cdsrc.json", () => {
            appConfig = {
                appName: testGetPackageDataName,
                ordNamespace: testGetPackageOrdNamespace,
                existingProductORDId: "sap:product:SAPServiceCloudV2:",
                products: [
                    {
                        ordId: "customer:product:eb.bm.tests:",
                        vendor: "sap:vendor:SAP:",
                    },
                ],
                policyLevels: ["policy"],
            };
            expect(defaults.packages(appConfig)).toMatchSnapshot();
        });

        it("should use custom vendor if it defined in .cdsrc.json", () => {
            appConfig = {
                appName: testGetPackageDataName,
                ordNamespace: testGetPackageOrdNamespace,
                env: {
                    packages: [
                        {
                            vendor: "sap:vendor:SAP:",
                        },
                    ],
                },
                policyLevels: ["policy"],
            };
            expect(defaults.packages(appConfig)).toMatchSnapshot();
        });

        it("should not contain partOfProducts if no productsOrdId found", () => {
            appConfig = {
                appName: testGetPackageDataName,
                ordNamespace: testGetPackageOrdNamespace,
                policyLevels: ["policy"],
            };
            expect(defaults.packages(appConfig)).toMatchSnapshot();
        });
    });

    describe("consumptionBundles", () => {
        const testAppConfig = {
            appName: "sap.xref",
            lastUpdate: "2024-06-20T14:04:01+01:00",
        };
        it("should return default value", () => {
            expect(defaults.consumptionBundles(testAppConfig)).toMatchSnapshot();
        });
    });
    describe("baseTemplate", () => {
        it("should return default value", () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Open],
                accessStrategies: [{ type: AUTHENTICATION_TYPE.Open }],
            };
            expect(defaults.baseTemplate(authConfig)).toMatchSnapshot();
        });

        it("should include perspective when configured", () => {
            const authConfig = {
                accessStrategies: [{ type: AUTHENTICATION_TYPE.Open }],
            };
            const ordConfig = { perspective: "system-version" };
            const result = defaults.baseTemplate(authConfig, ordConfig);
            expect(result.openResourceDiscoveryV1.documents[0].perspective).toBe("system-version");
        });

        it("should not include perspective when not configured", () => {
            const authConfig = {
                accessStrategies: [{ type: AUTHENTICATION_TYPE.Open }],
            };
            const result = defaults.baseTemplate(authConfig);
            expect(result.openResourceDiscoveryV1.documents[0].perspective).toBeUndefined();
        });

        it("should not include perspective when ordConfig is empty", () => {
            const authConfig = {
                accessStrategies: [{ type: AUTHENTICATION_TYPE.Open }],
            };
            const result = defaults.baseTemplate(authConfig, {});
            expect(result.openResourceDiscoveryV1.documents[0].perspective).toBeUndefined();
        });
    });
});
