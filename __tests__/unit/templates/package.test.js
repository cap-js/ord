const { createPackages } = require("../../../lib/templates/package");

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

    it("should return only custom value if user definitions in .cdsrc.json are done correctly", () => {
        expect(
            createPackages({
                policyLevels: ["policy"],
                appName: "My Package",
                ordNamespace: "customer.sample",
                packageName: "eb.bm.tests",
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
