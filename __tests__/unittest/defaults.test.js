const cds = require("@sap/cds");
const { AUTHENTICATION_TYPE } = require("../../lib/constants");
jest.spyOn(cds, "context", "get").mockReturnValue({
    authConfig: {
        types: [AUTHENTICATION_TYPE.Open],
        accessStrategies: [{ type: AUTHENTICATION_TYPE.Open }],
    },
});
const defaults = require("../../lib/defaults");

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
            const testpolicyLevels = "sap:policy";
            appConfig = {
                appName: testGetPackageDataName,
                ordNamespace: testGetPackageOrdNamespace,
            };
            expect(defaults.packages(appConfig, testpolicyLevels)).toMatchSnapshot();
        });

        it("should return default value if policyLevels does not contain sap", () => {
            const testpolicyLevels = "policy";
            appConfig = {
                appName: testGetPackageDataName,
                ordNamespace: testGetPackageOrdNamespace,
            };
            expect(defaults.packages(appConfig, testpolicyLevels)).toMatchSnapshot();
        });

        it("should return custom value if user defined in .cdsrc.json", () => {
            const testpolicyLevels = "policy";
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
                        },
                    ],
                },
            };
            expect(defaults.packages(appConfig, testpolicyLevels)).toMatchSnapshot();
        });

        it("should use existingProductId if provided in .cdsrc.json", () => {
            const testpolicyLevels = "policy";
            appConfig = {
                appName: testGetPackageDataName,
                ordNamespace: testGetPackageOrdNamespace,
                existingProductORDId: "sap:product:SAPServiceCloudV2:",
            };
            expect(defaults.packages(appConfig, testpolicyLevels)).toMatchSnapshot();
        });

        it("should use existingProductId if existingProductId and custom product both provided in .cdsrc.json", () => {
            const testpolicyLevels = "policy";
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
            };
            expect(defaults.packages(appConfig, testpolicyLevels)).toMatchSnapshot();
        });

        it("should use custom vendor if it defined in .cdsrc.json", () => {
            const testpolicyLevels = "policy";
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
            };
            expect(defaults.packages(appConfig, testpolicyLevels)).toMatchSnapshot();
        });

        it("should not contain partOfProducts if no productsOrdId found", () => {
            const testpolicyLevels = "policy";
            appConfig = {
                appName: testGetPackageDataName,
                ordNamespace: testGetPackageOrdNamespace,
            };
            expect(defaults.packages(appConfig, testpolicyLevels)).toMatchSnapshot();
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
            expect(defaults.baseTemplate).toMatchSnapshot();
        });
    });
});
