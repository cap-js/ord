const path = require("path");
const cds = require("@sap/cds");

const defaults = require("../../lib/defaults");
const { DOCUMENT_PERSPECTIVES, ORD_ACCESS_STRATEGY } = require("../../lib/constants");

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
            const packageJson = require(path.join(__dirname, "..", "..", "package.json"));

            expect(defaults.openResourceDiscovery).toMatchSnapshot();
            expect(
                packageJson.devDependencies["@open-resource-discovery/specification"].startsWith(
                    defaults.openResourceDiscovery,
                ),
            ).toBe(true);
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

    describe("baseTemplate", () => {
        it("should return correct value when no tenant is given and toggles & extensions are disabled", () => {
            cds.env.requires.toggles = false;
            cds.env.requires.extensibility = false;
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };
            expect(defaults.baseTemplate(authConfig, undefined)).toMatchSnapshot();
        });

        it("should return correct value when tenant is not given and only toggles are enabled", () => {
            cds.env.requires.toggles = true;
            cds.env.requires.extensibility = false;
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };
            expect(defaults.baseTemplate(authConfig, undefined)).toMatchSnapshot();
        });

        it("should return correct value when tenant is not given and only extensions are enabled", () => {
            cds.env.requires.toggles = false;
            cds.env.requires.extensibility = true;
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };
            expect(defaults.baseTemplate(authConfig, undefined)).toMatchSnapshot();
        });

        it("should return correct value when no tenant is given and toggles & extensions are enabled", () => {
            cds.env.requires.toggles = true;
            cds.env.requires.extensibility = true;
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };
            expect(defaults.baseTemplate(authConfig, undefined)).toMatchSnapshot();
        });

        it("should return correct value when tenant is given and only toggles are enabled", () => {
            cds.env.requires.toggles = true;
            cds.env.requires.extensibility = false;
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };
            expect(defaults.baseTemplate(authConfig, "dummy-tenant")).toMatchSnapshot();
        });

        it("should return correct value when tenant is given and extensions are enabled", () => {
            cds.env.requires.toggles = false;
            cds.env.requires.extensibility = true;
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };
            expect(defaults.baseTemplate(authConfig, "dummy-tenant")).toMatchSnapshot();
        });

        it("should return correct value when tenant is given and toggles & extensions are enabled", () => {
            cds.env.requires.toggles = true;
            cds.env.requires.extensibility = true;
            const authConfig = {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            };
            expect(defaults.baseTemplate(authConfig, "dummy-tenant")).toMatchSnapshot();
        });
    });

    describe("adjustForPerspective", () => {
        it("should return correct value when system-instance-perspective is given", () => {
            expect(
                defaults.adjustForPerspective(
                    {
                        apiResources: [
                            {
                                resourceDefinitions: [
                                    {
                                        url: "dummy/dummy.oas3.json",
                                    },
                                ],
                            },
                        ],
                        eventResources: [
                            {
                                resourceDefinitions: [
                                    {
                                        url: "dummy/dummy.asyncapi2.json",
                                    },
                                ],
                            },
                        ],
                    },
                    DOCUMENT_PERSPECTIVES.SystemInstance,
                ),
            ).toMatchSnapshot();
        });

        it("should return correct value when system-instance-version is given", () => {
            cds.env.ord = { describedSystemVersion: { version: "1.0" } };

            expect(
                defaults.adjustForPerspective(
                    {
                        apiResources: [
                            {
                                resourceDefinitions: [
                                    {
                                        url: "dummy/dummy.oas3.json",
                                    },
                                ],
                            },
                        ],
                        eventResources: [
                            {
                                resourceDefinitions: [
                                    {
                                        url: "dummy/dummy.asyncapi2.json",
                                    },
                                ],
                            },
                        ],
                    },
                    DOCUMENT_PERSPECTIVES.SystemVersion,
                ),
            ).toMatchSnapshot();
        });
    });
});
