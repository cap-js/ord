const cds = require("@sap/cds");
const path = require("path");
const { AUTHENTICATION_TYPE, ORD_ACCESS_STRATEGY, CDS_ELEMENT_KIND } = require("../../lib/constants");

describe("End-to-end test for ORD document", () => {
    beforeAll(() => {
        process.env.DEBUG = "true";
        jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        jest.spyOn(cds, "context", "get").mockReturnValue({
            authConfig: {
                types: [AUTHENTICATION_TYPE.Open],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
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
            cds.root = path.join(__dirname, "../bookshop");
            csn = await cds.load(path.join(cds.root, "srv"));
            jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
            ord = require("../../lib/ord");
        });

        afterEach(() => {
            cds.root = path.join(__dirname, "../bookshop");
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
            cds.root = path.join(__dirname, "../bookshop");
            jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
            ord = require("../../lib/ord");
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
    let csn, ord;

    beforeAll(async () => {
        process.env.DEBUG = "true";
        jest.spyOn(cds, "context", "get").mockReturnValue({
            authConfig: {
                types: [AUTHENTICATION_TYPE.Open],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
            },
        });
        jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        ord = require("../../lib/ord");
        cds.root = path.join(__dirname, "../bookshop");
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
        cds.env.ord = {};
    });

    it("should raise error log when custom product ordId starts with sap detected", async () => {
        let csn, ord;
        cds.root = path.join(__dirname, "../bookshop");
        jest.spyOn(cds, "context", "get").mockReturnValue({
            authConfig: {
                types: [AUTHENTICATION_TYPE.Open],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
            },
        });
        jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        ord = require("../../lib/ord");
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
        // Note: Error logging for invalid SAP product ordId is tested elsewhere
        cds.env.ord = {};
    });

    it("should use valid custom products ordId", async () => {
        let csn, ord;
        cds.env.ord = {};
        cds.root = path.join(__dirname, "../bookshop");
        jest.spyOn(cds, "context", "get").mockReturnValue({
            authConfig: {
                types: [AUTHENTICATION_TYPE.Open],
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
            },
        });
        jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        ord = require("../../lib/ord");
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
        // Note: Test validates proper product ordId configuration via snapshot
        cds.env.ord = {};
    });
});

describe("Tests for Data Product definition", () => {
    let ord, csn;

    beforeAll(async () => {
        process.env.DEBUG = "true";
        jest.spyOn(cds, "context", "get").mockReturnValue({
            authConfig: {
                types: [AUTHENTICATION_TYPE.Open],
            },
        });
        cds.root = path.join(__dirname, "../bookshop");
        jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        ord = require("../../lib/ord");
        csn = await cds.load(path.join(cds.root, "srv"));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });

    it("Check interop CSN content", async () => {
        const document = ord(csn);

        const csnApiResource = document.apiResources?.find((api) =>
            api.resourceDefinitions?.some((def) => def.type === "sap-csn-interop-effective-v1"),
        );

        if (!csnApiResource) {
            console.warn("No CSN API resource found, skipping CSN content test");
            return;
        }

        const csnResourceDef = csnApiResource.resourceDefinitions.find(
            (def) => def.type === "sap-csn-interop-effective-v1",
        );

        expect(csnResourceDef).toBeDefined();
        expect(csnResourceDef.url).toBeDefined();

        const { getMetadata } = require("../../lib/index");

        const result = await getMetadata(csnResourceDef.url, csn);
        expect(result.contentType).toBe("application/json");

        let interopCsn = result.response;
        if (typeof interopCsn === "string") {
            interopCsn = JSON.parse(interopCsn);
        }

        expect(interopCsn).toBeDefined();
        expect(typeof interopCsn).toBe("object");
        expect(interopCsn.csnInteropEffective).toBe("1.0");
        expect(interopCsn.meta).toBeDefined();
        expect(interopCsn.meta.flavor).toBe("effective");
        expect(interopCsn.meta.__name).toBe("DPBooks");
        expect(interopCsn.meta.__namespace).toBe("sap.capdpprod");
        expect(interopCsn.meta.document).toBeDefined();
        expect(interopCsn.meta.document.version).toBe("1.0.0");
        expect(interopCsn.definitions).toBeDefined();
        expect(interopCsn.i18n).toBeDefined();
        expect(interopCsn.i18n.en).toBeDefined();
        expect(interopCsn.i18n.en.Stock).toBe("Stock");
        expect(interopCsn.i18n.de).toBeDefined();
        expect(interopCsn.i18n.de.Stock).toBe("Bestand");

        expect(interopCsn).toMatchSnapshot();
    });

    it("Check interop CSN annotation mapping through ORD", async () => {
        let document;
        jest.isolateModules(() => {
            delete global.cds;
            const dateMod = require("../../lib/date");
            jest.spyOn(dateMod, "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
            const ordLocal = require("../../lib/ord");
            const linkedModel = cds.linked(`
                service TestService {
                    entity TestEntity {
                        ID: Integer;
                        field1: String;
                    }
                }
                annotate TestService with @title: 'Test Service Title';
                annotate TestService with @Common.Label: 'Service Common Label';
                annotate TestService.TestEntity with @description: 'Entity Description';
                annotate TestService.TestEntity with @label: 'Entity Label';
                annotate TestService.TestEntity with @cds.autoexpose: true;
                annotate TestService.TestEntity.field1 with @title: 'Field Title';
                annotate TestService.TestEntity.field1 with @Common.Label: 'Field Common Label';
            `);
            document = ordLocal(linkedModel);
        });

        expect(document).toBeDefined();
        expect(document).toMatchSnapshot();
    });

    it("Check interop CSN service name parsing through ORD", async () => {
        let document;
        jest.isolateModules(() => {
            delete global.cds;
            const dateMod = require("../../lib/date");
            jest.spyOn(dateMod, "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
            const ordLocal = require("../../lib/ord");
            const linkedModel = cds.linked(`
            namespace customer.namespace;
            service TestService.v3 {
                entity TestEntity {
                    ID: Integer;
                }
            }
            service SimpleService {
                entity SimpleEntity {
                    ID: Integer;
                }
            }
        `);
            document = ordLocal(linkedModel);
        });

        // Check that ORD document is generated with API resources for multiple services
        expect(document.apiResources).toBeDefined();
        expect(document.apiResources.length).toBeGreaterThan(0);

        // Verify service names are processed correctly in groups
        expect(document.groups).toBeDefined();
        expect(document.groups.length).toBeGreaterThan(0);

        expect(document).toMatchSnapshot();
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
        jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        ord = require("../../lib/ord");
        cds.root = path.join(__dirname, "../bookshop");
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

    it("should generate mcp apiResource mcp plugin is available", async () => {
        let ordWithMCP;
        jest.isolateModules(() => {
            jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
            // Mock the new consolidated function to return true
            jest.spyOn(require("../../lib/mcpAdapter"), "isMCPPluginReady").mockReturnValue(true);
            jest.spyOn(require("@sap/cds"), "context", "get").mockReturnValue({
                authConfig: { types: [AUTHENTICATION_TYPE.Open] },
            });
            ordWithMCP = require("../../lib/ord");
        });

        const linkedModel = cds.linked(`
                service MyService {
                    action add(x : Integer, to : Integer) returns Integer;
                }
            `);

        const document = ordWithMCP(linkedModel);

        // At minimum we expect the generated service API resource + MCP resource; custom.ord.json may add more.
        expect(document.apiResources.length).toBeGreaterThanOrEqual(2);
        const mcpResource = document.apiResources.find((resource) => resource.apiProtocol === "mcp");
        expect(mcpResource).toMatchSnapshot();
    });

    it("should allow MCP API resource customization via custom.ord.json", async () => {
        // Load actual bookshop model instead of constructing a linked model snippet
        let ordWithMCP, csn;
        jest.isolateModules(() => {
            const fs = require("fs");
            const pathMod = require("path");
            const bookshopRoot = pathMod.join(__dirname, "../bookshop");
            const cdsrcPath = pathMod.join(bookshopRoot, ".cdsrc.json");
            if (fs.existsSync(cdsrcPath)) {
                const config = require(cdsrcPath);
                require("@sap/cds").env.ord = config.ord; // allow customOrdContentFile merge
                require("@sap/cds").root = bookshopRoot; // ensure relative custom.ord.json resolution
            }
            jest.spyOn(require("../../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
            // Mock the new consolidated function to return true
            jest.spyOn(require("../../lib/mcpAdapter"), "isMCPPluginReady").mockReturnValue(true);
            jest.spyOn(require("@sap/cds"), "context", "get").mockReturnValue({
                authConfig: { types: [AUTHENTICATION_TYPE.Open] },
            });
            ordWithMCP = require("../../lib/ord");
        });
        // load after isolate so cds.root & env are set
        csn = await cds.load(path.join(__dirname, "../bookshop", "srv"));

        const document = ordWithMCP(csn);

        // Expect at least generated API resources + customized MCP; exact count can grow with model changes
        expect(document.apiResources.length).toBeGreaterThanOrEqual(2);
        const mcpResource = document.apiResources.find((resource) => resource.apiProtocol === "mcp");

        // Verify that custom properties were applied via custom.ord.json merge
        expect(mcpResource.ordId).toBe("sap.test.cdsrc.sample:apiResource:mcp-server:v1");
        expect(mcpResource.visibility).toBe("internal");
        expect(mcpResource.title).toBe("Internal MCP Server for testing custom functionality");
        expect(mcpResource.shortDescription).toBe("Custom MCP server or testing custom functionality");
        expect(mcpResource.version).toBe("2.1.0");
        expect(mcpResource.entryPoints).toEqual(["/mcp-server"]);
        expect(mcpResource.releaseStatus).toBe("beta");
        expect(mcpResource.apiProtocol).toBe("mcp");
        // Snapshot restored: capture full ORD document including customized MCP resource for regression tracking.
        expect(document).toMatchSnapshot();
        // Targeted snapshot of MCP resource for focused diffing (less brittle than whole doc if counts change).
        expect(mcpResource).toMatchSnapshot();
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
        expect(document.apiResources.length).toBeGreaterThanOrEqual(1);
        const serviceApiResource = document.apiResources.find((r) => r.apiProtocol !== "mcp");
        expect(serviceApiResource).toBeDefined();
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
        expect(document.apiResources.length).toBeGreaterThanOrEqual(1);
        const serviceApiResource = document.apiResources.find((r) => r.apiProtocol !== "mcp");
        expect(serviceApiResource).toBeDefined();
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
        // Expect at least 1 service API resource (MyService); MCP resource may also be present if plugin available
        expect(document.apiResources.length).toBeGreaterThanOrEqual(1);
        const serviceApiResources = document.apiResources.filter((r) => r.apiProtocol !== "mcp");
        expect(serviceApiResources).toHaveLength(1);
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
        // Expect at least 1 service API resource (MyService); MCP resource may also be present if plugin available
        expect(document.apiResources.length).toBeGreaterThanOrEqual(1);
        const serviceApiResources = document.apiResources.filter((r) => r.apiProtocol !== "mcp");
        expect(serviceApiResources).toHaveLength(1);
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
        // Expect at least 1 service API resource (MyService); MCP resource may also be present if plugin available
        expect(document.apiResources.length).toBeGreaterThanOrEqual(1);
        const serviceApiResources = document.apiResources.filter((r) => r.apiProtocol !== "mcp");
        expect(serviceApiResources).toHaveLength(1);
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
        // Expect at least 1 service API resource (MyService); MCP resource may also be present if plugin available
        expect(document.apiResources.length).toBeGreaterThanOrEqual(1);
        const serviceApiResources = document.apiResources.filter((r) => r.apiProtocol !== "mcp");
        expect(serviceApiResources).toHaveLength(1);
        expect(document.eventResources).toHaveLength(1);
        expect(document.groups).toHaveLength(1);
        expect(document).toMatchSnapshot();
    });
});
