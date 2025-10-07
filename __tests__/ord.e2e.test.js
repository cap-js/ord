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
            expect(() => ord(csn)).toThrow("package.json not found in the project root directory");
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

describe("Tests for Data Product definition", () => {
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

    it("Check interop CSN for Data Product", async () => {
        const { interopCSN } = require("../lib/interop-csn");
        csn = await cds.load(path.join(cds.root, "srv"));

        const interopCsn = interopCSN(csn);

        expect(interopCsn).toHaveProperty("csnInteropEffective", "1.0");
        expect(interopCsn).toHaveProperty("meta.flavor", "effective");
        expect(interopCsn).toHaveProperty("definitions");
        expect(interopCsn).toHaveProperty("i18n");
        expect(interopCsn).toMatchSnapshot();
    });

    it("Check interop CSN annotation mapping", async () => {
        const { interopCSN } = require("../lib/interop-csn");

        // Create test CSN with various annotations
        const testCsn = {
            definitions: {
                TestService: {
                    "kind": "service",
                    "@title": "Test Service Title",
                    "@Common.Label": "Service Common Label",
                },
                TestEntity: {
                    "kind": "entity",
                    "@description": "Entity Description",
                    "@label": "Entity Label",
                    "@cds.autoexpose": true,
                    "elements": {
                        field1: {
                            "@title": "Field Title",
                            "@Common.Label": "Field Common Label",
                        },
                    },
                },
            },
        };

        const interopCsn = interopCSN(testCsn);

        // Check annotation mappings
        expect(interopCsn.definitions.TestService["@EndUserText.label"]).toBe("Service Common Label");
        expect(interopCsn.definitions.TestEntity["@EndUserText.quickInfo"]).toBe("Entity Description");
        expect(interopCsn.definitions.TestEntity.elements.field1["@EndUserText.label"]).toBe("Field Common Label");

        // Check removed annotations
        expect(interopCsn.definitions.TestEntity["@cds.autoexpose"]).toBeUndefined();

        expect(interopCsn).toMatchSnapshot();
    });

    it("Check interop CSN service name parsing", async () => {
        const { interopCSN } = require("../lib/interop-csn");

        const testCsn = {
            definitions: {
                "customer.namespace.TestService.v3": { kind: "service" },
                "SimpleService": { kind: "service" }
            }
        };

        const interopCsn = interopCSN(testCsn);

        // Should not set document info for multiple services
        expect(interopCsn.meta.document).toBeUndefined();
        expect(interopCsn.meta.__name).toBeUndefined();
        expect(interopCsn.meta.__namespace).toBeUndefined();
        
        expect(interopCsn).toMatchSnapshot();
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
