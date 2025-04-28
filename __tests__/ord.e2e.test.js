const cds = require("@sap/cds");
const path = require("path");
const { AUTHENTICATION_TYPE } = require('../lib/constants');

describe("End-to-end test for ORD document", () => {

    beforeAll(() => {
        process.env.DEBUG = "true";
        jest.spyOn(cds, "context", "get").mockReturnValue({
            authConfig: {
                types: [AUTHENTICATION_TYPE.Open]
            }
        });
    });

    afterAll(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });

    describe("Tests for default ORD document when .cdsrc.json is present", () => {
        let csn, ord;

        beforeAll(async () => {
            cds.root = path.join(__dirname, "bookshop");
            csn = await cds.load(path.join(cds.root, "srv"));
            jest.spyOn(require("../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
            ord = require("../lib/ord");
        });

        afterEach(() => {
            cds.root = path.join(__dirname, "bookshop");
            delete cds.env.export;
        });

        test("Successfully create ORD Documents with defaults", () => {
            const document = ord(csn);
            expect(document).toMatchSnapshot();
        });

        test("Successfully create ORD Documents with defaults and applicationNamespace configured incorrectly", () => {
            cds.env.export = {
                asyncapi: {
                    applicationNamespace: "non-ord-namespace"
                }
            };
            const document = ord(csn);
            expect(document).toMatchSnapshot();
        });

        test("Exception thrown while package.json not found", () => {
            cds.root = path.join(__dirname, "folderWithNoPackageJson");
            expect(() => ord(csn)).toThrowError("package.json not found in the project root directory");
        });

        describe("apiResources", () => {
            // eslint-disable-next-line no-useless-escape
            const PACKAGE_ID_REGEX = /^([a-z0-9]+(?:[.][a-z0-9]+)*):(package):([a-zA-Z0-9._\-]+):(v0|v[1-9][0-9]*)$/;

            let document;

            beforeAll(() => {
                document = ord(csn);
            });

            test("PartOfPackage values are valid ORD IDs ", () => {
                for (const apiResource of document.apiResources) {
                    expect(apiResource.partOfPackage).toMatch(PACKAGE_ID_REGEX);
                }
            });

            test("The partOfPackage references an existing package", () => {
                for (const apiResource of document.apiResources) {
                    expect(
                        document.packages.find(
                            (pck) => pck.ordId === apiResource.partOfPackage
                        )
                    ).toBeDefined();
                }
            });
        });

        describe("eventResources", () => {
            // eslint-disable-next-line no-useless-escape
            const GROUP_ID_REGEX = /^([a-z0-9-]+(?:[.][a-z0-9-]+)*):([a-zA-Z0-9._\-/]+):([a-z0-9-]+(?:[.][a-z0-9-]+)*):(?<service>[a-zA-Z0-9._\-/]+)$/;

            let document;

            beforeAll(() => {
                document = ord(csn);
            });

            test("Assigned to exactly one CDS Service group", () => {
                for (const eventResource of document.eventResources) {
                    expect(eventResource.partOfGroups.length).toEqual(1);
                }
            });

            test("The CDS Service Group ID includes the CDS Service identifier", () => {
                for (const eventResource of document.eventResources) {
                    const [groupId] = eventResource.partOfGroups;
                    expect(groupId).toMatch(GROUP_ID_REGEX);

                    const match = GROUP_ID_REGEX.exec(groupId);
                    if (match && match.groups?.service) {
                        let service = match.groups?.service;
                        if (service.startsWith("undefined"))
                            service = service.replace("undefined.", "");
                        const definition = csn.definitions[service];
                        expect(definition).toBeDefined();
                        expect(definition.kind).toEqual("service");
                    }
                }
            });
        });
    });

    describe("Tests for default ORD document when .cdsrc.json is not present", () => {
        let csn, ord;

        beforeAll(async () => {
            jest.spyOn(require("../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
            ord = require("../lib/ord");
            cds.root = path.join(__dirname, "bookshop");
            csn = await cds.load(path.join(cds.root, "srv"));
        });

        afterAll(() => {
            jest.clearAllMocks();
            jest.resetAllMocks();
        });

        test("Successfully create ORD Documents with defaults", () => {
            const document = ord(csn);
            expect(document).toMatchSnapshot();
        });

        describe("apiResources", () => {
            // eslint-disable-next-line no-useless-escape
            const PACKAGE_ID_REGEX = /^([a-z0-9]+(?:[.][a-z0-9]+)*):(package):([a-zA-Z0-9._\-]+):(v0|v[1-9][0-9]*)$/;

            let document;

            beforeAll(() => {
                document = ord(csn);
            });

            test("partOfPackage values are valid ORD IDs ", () => {
                for (const apiResource of document.apiResources) {
                    expect(apiResource.partOfPackage).toMatch(PACKAGE_ID_REGEX);
                }
            });

            test("The partOfPackage references an existing package", () => {
                for (const apiResource of document.apiResources) {
                    expect(
                        document.packages.find(
                            (pck) => pck.ordId === apiResource.partOfPackage
                        )
                    ).toBeDefined();
                }
            });
        });

        describe("eventResources", () => {
            // eslint-disable-next-line no-useless-escape
            const GROUP_ID_REGEX = /^([a-z0-9-]+(?:[.][a-z0-9-]+)*):([a-zA-Z0-9._\-/]+):([a-z0-9-]+(?:[.][a-z0-9-]+)*):(?<service>[a-zA-Z0-9._\-/]+)$/;

            let document;

            beforeAll(() => {
                document = ord(csn);
            });

            test("Assigned to exactly one CDS Service group", () => {
                for (const eventResource of document.eventResources) {
                    expect(eventResource.partOfGroups.length).toEqual(1);
                }
            });

            test("The CDS Service Group ID includes the CDS Service identifier", () => {
                for (const eventResource of document.eventResources) {
                    const [groupId] = eventResource.partOfGroups;
                    expect(groupId).toMatch(GROUP_ID_REGEX);

                    const match = GROUP_ID_REGEX.exec(groupId);
                    if (match && match.groups?.service) {
                        let service = match.groups?.service;
                        if (service.startsWith("undefined"))
                            service = service.replace("undefined.", "");
                        const definition = csn.definitions[service];
                        expect(definition).toBeDefined();
                        expect(definition.kind).toEqual("service");
                    }
                }
            });
        });
    });
});

describe("Tests for products and packages", () => {
    let csn, ord, errorSpy;

    beforeAll(async () => {
        process.env.DEBUG = "true";
        jest.spyOn(cds, "context", "get").mockReturnValue({
            authConfig: {
                types: [AUTHENTICATION_TYPE.Open]
            }
        });
        jest.spyOn(require("../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        ord = require("../lib/ord");
        cds.root = path.join(__dirname, "bookshop");
        errorSpy = jest.spyOn(console, "error");
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();

    });

    it("should not contain products property if existingProductId provided", async () => {
        cds.env.ord = {
            existingProductORDId: "sap:product:SAPServiceCloudV2:"
        };
        csn = await cds.load(path.join(cds.root, "srv"));

        const document = ord(csn);
        expect(document).toMatchSnapshot();
    });

    it("should raise error log when custom product ordId starts with sap detected", async () => {
        let csn, ord;
        cds.root = path.join(__dirname, "bookshop");
        jest.spyOn(require("../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        ord = require("../lib/ord");
        cds.env.ord = {
            "products": [
                {
                    "ordId": "sap:product:eb.bm.tests:",
                    "vendor": "sap:vendor:SAP:"
                }
            ],
        };
        csn = await cds.load(path.join(cds.root, "srv"));

        const document = ord(csn);
        expect(document).toMatchSnapshot();
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("should use valid custom products ordId", async () => {
        let csn, ord;
        cds.env.ord = {};
        cds.root = path.join(__dirname, "bookshop");
        jest.spyOn(require("../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        ord = require("../lib/ord");
        cds.env.ord = {
            "products": [
                {
                    "ordId": "customer:product:eb.bm.tests:",
                    "vendor": "sap:vendor:SAP:"
                }
            ],
        };
        csn = await cds.load(path.join(cds.root, "srv"));

        const document = ord(csn);
        expect(document).toMatchSnapshot();
        expect(errorSpy).toHaveBeenCalledTimes(0);
    });
});

