const defaults = require("../../lib/defaults");
const { AUTHENTICATION_TYPE, DOCUMENT_PERSPECTIVES } = require("../../lib/constants");
const cds = require("@sap/cds");

jest.mock("fs", () => {
    return {
        readFileSync: () => JSON.stringify({ version: "1.0.0" }),
    };
});

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
                hasSAPPolicyLevel: true,
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
            expect(
                defaults.packages(appConfig, [{ ordId: "customer:product:eb.bm.tests:", vendor: "sap:vendor:SAP:" }]),
            ).toMatchSnapshot();
        });

        it("should return only custom value if user definitions in .cdsrc.json are done correctly", () => {
            appConfig = {
                appName: testGetPackageDataName,
                ordNamespace: testGetPackageOrdNamespace,
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
            expect(
                defaults.packages(appConfig, [{ ordId: "customer:product:eb.bm.tests:", vendor: "sap:vendor:SAP:" }]),
            ).toMatchSnapshot();
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
                policyLevels: ["policy"],
            };
            expect(
                defaults.packages(appConfig, [{ ordId: "customer:product:eb.bm.tests:", vendor: "sap:vendor:SAP:" }]),
            ).toMatchSnapshot();
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
    });

    describe("resolveDocumentPerspectiveExtension", () => {
        it("should return correct value when loading version from .cdsrc.json", () => {
            cds.env.ord = { describedSystemVersion: { version: "0.1.0" } };

            expect(defaults.resolveDocumentPerspectiveExtension()).toEqual({
                perspective: DOCUMENT_PERSPECTIVES.SystemVersion,
                describedSystemVersion: {
                    version: "0.1.0",
                },
            });
        });

        it("should return correct value when loading version from package.json", () => {
            cds.env.ord = undefined;
            cds.root = ".";

            expect(defaults.resolveDocumentPerspectiveExtension()).toEqual({
                perspective: DOCUMENT_PERSPECTIVES.SystemVersion,
                describedSystemVersion: {
                    version: "1.0.0",
                },
            });
        });
    });
});
