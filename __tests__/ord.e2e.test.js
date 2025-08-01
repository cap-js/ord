const cds = require("@sap/cds");
const path = require("path");
const { AUTHENTICATION_TYPE, CDS_ELEMENT_KIND } = require("../lib/constants");

describe("End-to-end test for ORD document", () => {
    beforeAll(() => {
        process.env.DEBUG = "true";
        jest.spyOn(cds, "context", "get").mockReturnValue({
            authConfig: {
                types: [AUTHENTICATION_TYPE.Open],
            },
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
                    applicationNamespace: "non-ord-namespace",
                },
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
                    expect(document.packages.find((pck) => pck.ordId === apiResource.partOfPackage)).toBeDefined();
                }
            });
        });

        describe("eventResources", () => {
            // eslint-disable-next-line no-useless-escape
            const GROUP_ID_REGEX =
                /^([a-z0-9-]+(?:[.][a-z0-9-]+)*):([a-zA-Z0-9._\-/]+):([a-z0-9-]+(?:[.][a-z0-9-]+)*):(?<service>[a-zA-Z0-9._\-/]+)$/;

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
                        const definition = csn.definitions[service];
                        expect(definition).toBeDefined();
                        expect(definition.kind).toEqual(CDS_ELEMENT_KIND.service);
                    }
                }
            });
        });
    });

    describe("Tests for default ORD document when .cdsrc.json is not present", () => {
        let csn, ord;

        beforeAll(async () => {
            cds.root = path.join(__dirname, "bookshop");
            jest.spyOn(require("../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
            ord = require("../lib/ord");
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
                    expect(document.packages.find((pck) => pck.ordId === apiResource.partOfPackage)).toBeDefined();
                }
            });
        });

        describe("eventResources", () => {
            // eslint-disable-next-line no-useless-escape
            const GROUP_ID_REGEX =
                /^([a-z0-9-]+(?:[.][a-z0-9-]+)*):([a-zA-Z0-9._\-/]+):([a-z0-9-]+(?:[.][a-z0-9-]+)*):(?<service>[a-zA-Z0-9._\-/]+)$/;

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
                        const definition = csn.definitions[service];
                        expect(definition).toBeDefined();
                        expect(definition.kind).toEqual(CDS_ELEMENT_KIND.service);
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
                types: [AUTHENTICATION_TYPE.Open],
            },
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
            existingProductORDId: "sap:product:SAPServiceCloudV2:",
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
            products: [
                {
                    ordId: "sap:product:eb.bm.tests:",
                    vendor: "sap:vendor:SAP:",
                },
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
            products: [
                {
                    ordId: "customer:product:eb.bm.tests:",
                    vendor: "sap:vendor:SAP:",
                },
            ],
        };
        csn = await cds.load(path.join(cds.root, "srv"));

        const document = ord(csn);
        expect(document).toMatchSnapshot();
        expect(errorSpy).toHaveBeenCalledTimes(0);
        cds.env.ord = {};
    });
});

describe("Tests for eventResource and apiResource", () => {
    let ord;

    beforeAll(() => {
        process.env.DEBUG = "true";
        jest.spyOn(cds, "context", "get").mockReturnValue({
            authConfig: {
                types: [AUTHENTICATION_TYPE.Open],
            },
        });
        jest.spyOn(require("../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        ord = require("../lib/ord");
        cds.root = path.join(__dirname, "bookshop");
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });

    it("should not contain apiResource if only event in service, but should contain groups", async () => {
        const linkedModel = cds.linked(`
                service MyService {
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                }
                annotate MyService with @ORD.Extensions : {
                    visibility : 'internal',
                };
            `);

        const document = ord(linkedModel);
        expect(document.apiResources).toBeUndefined();
        expect(document.eventResources).toHaveLength(1);
        expect(document.groups[0].groupId).toEqual("sap.cds:service:customer.capirebookshopordsample:MyService");
    });

    it("should generate apiResource if actions in service", async () => {
        const linkedModel = cds.linked(`
                service MyService {
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                    action   add(x : Integer, to : Integer) returns Integer;
                }
                annotate MyService with @ORD.Extensions : {
                    visibility : 'internal'
                };
            `);

        const document = ord(linkedModel);
        expect(document.apiResources).toHaveLength(1);
        expect(document.eventResources).toHaveLength(1);
        expect(document.groups).toHaveLength(1);
    });

    it("should generate apiResource if functions in service", async () => {
        const linkedModel = cds.linked(`
                service MyService {
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                    function getRatings() returns Integer;
                }
                annotate MyService with @ORD.Extensions : {
                    visibility : 'internal'
                };
            `);

        const document = ord(linkedModel);
        expect(document.apiResources).toHaveLength(1);
        expect(document.eventResources).toHaveLength(1);
        expect(document.groups).toHaveLength(1);
    });

    it("should block MTXServices when multitenancy is enbaled", async () => {
        const linkedModel = cds.linked(`
                namespace cds.xt;
                service MTXServices {
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                };
                service MyService {
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                    function getRatings() returns Integer;
                };
                annotate MyService with @ORD.Extensions : {
                    visibility : 'internal'
                };
            `);

        const document = ord(linkedModel);
        expect(document.apiResources).toHaveLength(1);
        expect(document.eventResources).toHaveLength(1);
        expect(document.groups).toHaveLength(1);
        expect(document).toMatchSnapshot();
    });

    it("should block OpenResourceDiscoveryService", async () => {
        const linkedModel = cds.linked(`
                service OpenResourceDiscoveryService {
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                };
                service MyService {
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                    function getRatings() returns Integer;
                };
                annotate MyService with @ORD.Extensions : {
                    visibility : 'internal'
                };
            `);

        const document = ord(linkedModel);
        expect(document.apiResources).toHaveLength(1);
        expect(document.eventResources).toHaveLength(1);
        expect(document.groups).toHaveLength(1);
        expect(document).toMatchSnapshot();
    });

    it("should exclude service when it has procotol none", async () => {
        const linkedModel = cds.linked(`
                @protocol: 'none'
                service InternalService {
                    event InternalEvent: {
                        ID: Integer;
                    }

                    entity InternalEntity {
                        ID: Integer;
                    }
                }

                service MyService {
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                    function getRatings() returns Integer;
                };
                annotate MyService with @ORD.Extensions : {
                    visibility : 'internal'
                };
            `);

        const document = ord(linkedModel);
        expect(document.apiResources).toHaveLength(1);
        expect(document.eventResources).toHaveLength(1);
        expect(document.groups).toHaveLength(1);
        expect(document).toMatchSnapshot();
    });

    it("should exclude external service", async () => {
        const linkedModel = cds.linked(`
                service ExternalService {
                    event InternalEvent: {
                        ID: Integer;
                    }

                    entity InternalEntity {
                        ID: Integer;
                    }
                }

                service MyService {
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                    function getRatings() returns Integer;
                };
                annotate MyService with @ORD.Extensions : {
                    visibility : 'internal'
                };
            `);
        cds.requires.ExternalService = {
            kind: "external",
            model: "external-model",
        };
        const document = ord(linkedModel);
        expect(document.apiResources).toHaveLength(1);
        expect(document.eventResources).toHaveLength(1);
        expect(document.groups).toHaveLength(1);
        expect(document).toMatchSnapshot();
    });
});
