const cds = require("@sap/cds");

const {
    createAPIResources,
    createAPIResourceTemplate,
    _getPackageID,
    _getExposedEntityTypes,
} = require("../../../lib/templates/api-resource");
const {
    DATA_PRODUCT_TYPE,
    ORD_ACCESS_STRATEGY,
    DATA_PRODUCT_ANNOTATION,
    MCP_RESOURCE_DEFINITION_TYPE,
    DATA_PRODUCT_SIMPLE_ANNOTATION,
    ENTITY_RELATIONSHIP_ANNOTATION,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
} = require("../../../lib/constants");

describe("createAPIResourceTemplate", () => {
    let linkedModel;

    const appConfig = {
        ordNamespace: "customer.testNamespace",
        appName: "testAppName",
        packageName: "TestPackage",
        lastUpdate: "2022-12-19T15:47:04+00:00",
        policyLevels: ["none"],
        accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
    };

    beforeAll(() => {
        linkedModel = cds.linked(`
            namespace customer.testNamespace123;
            entity Books {
                key ID: UUID;
                title: String;
            }
        `);
    });

    it("should create API resource template correctly for multi-protocol services", () => {
        const model = cds.linked(`
                @rest
                @odata
                service MyService {}
            `);

        expect(createAPIResourceTemplate(model.definitions["MyService"], appConfig)).toMatchSnapshot();
    });

    it("should create API resource template correctly for multi-protocol services when ordId is overridden for specific protocol", () => {
        const model = cds.linked(`
                @rest
                @odata
                @![protocol('rest')].ORD.Extensions.ordId: 'customer.testNamespace:apiResource:MyService-customized-rest:v1'
                service MyService {}
            `);

        expect(createAPIResourceTemplate(model.definitions["MyService"], appConfig)).toMatchSnapshot();
    });

    it("should create API resource template correctly for multi-protocol services when ordId is overridden", () => {
        const model = cds.linked(`
                @rest
                @odata
                @ORD.Extensions.ordId: 'customer.testNamespace:apiResource:MyService-customized-odata-v4:v1'
                @![protocol('rest')].ORD.Extensions.ordId: 'customer.testNamespace:apiResource:MyService-customized-rest:v1'
                service MyService {}
            `);

        expect(createAPIResourceTemplate(model.definitions["MyService"], appConfig)).toMatchSnapshot();
    });

    it("should return api resource with correct title from annotation '@EndUserText.label'", () => {
        const model = cds.linked(`service MyService @(EndUserText.label: 'This is MyService title' ) { }`);

        const apiResources = createAPIResourceTemplate(model.definitions["MyService"], appConfig);

        expect(apiResources).toBeInstanceOf(Array);
        expect(apiResources.length).toEqual(1);
        expect(apiResources[0].title).toEqual("This is MyService title");
    });

    it("should create API resource template correctly", () => {
        const model = cds.linked(`
                service MyService {
                   entity Books {
                       key ID: UUID;
                       title: String;
                   }
                };
            `);

        expect(createAPIResourceTemplate(model.definitions["MyService"], appConfig)).toMatchSnapshot();
    });

    it("should not create API resource template when the visibility is private", () => {
        const model = cds.linked(`
                namespace customer.testNamespace;
                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                };
                annotate MyService with @ORD.Extensions : {
                    visibility : 'private'
                };
            `);

        const srvDefinition = model.definitions["customer.testNamespace.MyService"];
        expect(createAPIResourceTemplate(srvDefinition, appConfig)).toEqual([]);
    });

    it("should create correct resource definition for MCP protocol", () => {
        // CAP core doesn't recognize 'mcp' protocol (@protocol: 'mcp' returns empty endpoints)
        // Only added when plugin is there
        // So we need to mock the protocol resolver to test the MCP resource definition branch
        jest.resetModules();

        jest.doMock("../../../lib/protocol-resolver", () => ({
            resolveApiResourceProtocol: jest.fn().mockReturnValue([
                {
                    apiProtocol: "mcp",
                    entryPoints: ["/mcp/mcp-service"],
                    hasResourceDefinitions: true,
                },
            ]),
        }));

        const {
            createAPIResourceTemplate: createAPIResourceTemplateMocked,
        } = require("../../../lib/templates/api-resource");

        const model = cds.linked(`
                    service McpService {
                       entity Items {
                           key ID: UUID;
                           name: String;
                       }
                    };
                `);
        const srvDefinition = model.definitions["McpService"];

        const apiResourceTemplate = createAPIResourceTemplateMocked(srvDefinition, appConfig);

        expect(apiResourceTemplate).toHaveLength(1);
        const mcpResource = apiResourceTemplate[0];
        expect(mcpResource.apiProtocol).toBe("mcp");
        expect(mcpResource.resourceDefinitions).toHaveLength(1);
        expect(mcpResource.resourceDefinitions[0].type).toBe(MCP_RESOURCE_DEFINITION_TYPE);
        expect(mcpResource.resourceDefinitions[0].mediaType).toBe("application/json");
        expect(mcpResource.resourceDefinitions[0].url).toContain(".mcp.json");

        jest.dontMock("../../../lib/protocol-resolver");
        jest.resetModules();
    });

    it('should add apiResources with ORD Extension "visibility=public"', () => {
        linkedModel = cds.linked(`
                @ODM.entityName: 'testOdmEntity'
                entity MyBooks {
                    key ID: UUID;
                    title: String;
                }

                service MyService {
                    entity Books as projection on MyBooks;
                }
                annotate MyService with @ORD.Extensions : {
                    ordId           : 'customer.testNamespace:apiResource:CustomizedMyService:v2',
                    title           : 'This is test MyService apiResource title',
                    shortDescription: 'short description for test MyService apiResource',
                    visibility : 'public',
                    version : '2.0.0',
                    partOfPackage : 'sap.test.cdsrc.sample:package:test-other:v1',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
        const srvDefinition = linkedModel.definitions["MyService"];
        appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
        const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig);

        expect(apiResourceTemplate).toBeInstanceOf(Array);
        expect(apiResourceTemplate).toMatchSnapshot();
    });

    it("should include internal API resources but ensure they appear in a separate package", () => {
        linkedModel = cds.linked(`
                @ODM.entityName: 'testOdmEntity'
                entity MyBooks {
                    key ID: UUID;
                    title: String;
                }

                service MyService {
                    entity Books as projection on MyBooks;
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService apiResource title',
                    shortDescription: 'short description for test MyService apiResource',
                    visibility : 'internal',
                    version : '2.0.0',
                    partOfPackage : 'sap.test.cdsrc.sample:package:test-other:v1',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
        const srvDefinition = linkedModel.definitions["MyService"];
        appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
        const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig);

        expect(apiResourceTemplate).toBeInstanceOf(Array);
        expect(apiResourceTemplate).toMatchSnapshot();
        expect(apiResourceTemplate[0].visibility).toEqual("internal");
    });

    it('should not add apiResources with ORD Extension "visibility=private"', () => {
        linkedModel = cds.linked(`
                @ODM.entityName: 'testOdmEntity'
                entity MyBooks {
                    key ID: UUID;
                    title: String;
                }

                service MyService {
                    entity Books as projection on MyBooks;
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService apiResource title',
                    shortDescription: 'short description for test MyService apiResource',
                    visibility : 'private',
                    version : '2.0.0',
                    partOfPackage : 'sap.test.cdsrc.sample:package:test-other:v1',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
        const srvDefinition = linkedModel.definitions["MyService"];
        appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
        const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig);

        expect(apiResourceTemplate).toBeInstanceOf(Array);
        expect(apiResourceTemplate).toMatchSnapshot();
        expect(apiResourceTemplate).toEqual([]);
    });

    it("should find composition and association entities for related service", () => {
        linkedModel = cds.linked(`
                entity AppCustomers {
                    key ID         : String;
                    addresses      : Composition of many Addresses on addresses.customer = $self;
                    incidents      : Association to many Incidents on incidents.customer = $self;
                }

                @ODM.entityName: 'CompositionOdmEntity'
                entity Addresses {
                    customer       : Association to AppCustomers;
                }

                @ODM.entityName: 'AssociationOdmEntity'
                entity Incidents {
                    customer       : Association to AppCustomers;
                }

                service MyService {
                    entity Customers as projection on AppCustomers;
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService apiResource title',
                    shortDescription: 'short description for test MyService apiResource',
                    visibility : 'public',
                    version : '2.0.0',
                    partOfPackage : 'sap.test.cdsrc.sample:package:test-other:v1',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
        const srvDefinition = linkedModel.definitions["MyService"];
        appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
        const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig);

        expect(apiResourceTemplate).toMatchSnapshot();
    });

    it("should find association on nested entities for related service", () => {
        linkedModel = cds.linked(`
                entity SecureApps {
                    key ID          : String;
                    components      : Association to many Components on components.app = $self;
                }

                @ODM.entityName: 'DirectAssociationOdmEntity'
                entity Components {
                    app            : Association to SecureApps;
                    incidents      : Association to many Incidents on incidents.component = $self;
                }

                @ODM.entityName: 'NestedAssociationOdmEntity'
                entity Incidents {
                    component       : Association to Components;
                }

                service MyService {
                    entity Apps as projection on SecureApps;
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService apiResource title',
                    shortDescription: 'short description for test MyService apiResource',
                    visibility : 'public',
                    version : '2.0.0',
                    partOfPackage : 'sap.test.cdsrc.sample:package:test-other:v1',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
        const srvDefinition = linkedModel.definitions["MyService"];
        appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
        const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig);

        expect(apiResourceTemplate).toMatchSnapshot();
    });

    it("should find composition on nested entities for related service", () => {
        linkedModel = cds.linked(`
                entity SecureApps {
                    key ID          : String;
                    components      : Composition of many Components on components.app = $self;
                }

                @ODM.entityName: 'DirectCompositionOdmEntity'
                entity Components {
                    app            : Association to SecureApps;
                    incidents      : Composition of many Incidents on incidents.component = $self;
                }

                @ODM.entityName: 'NestedCompositionOdmEntity'
                entity Incidents {
                    component       : Association to Components;
                }

                service MyService {
                    entity Apps as projection on SecureApps;
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService apiResource title',
                    shortDescription: 'short description for test MyService apiResource',
                    visibility : 'public',
                    version : '2.0.0',
                    partOfPackage : 'sap.test.cdsrc.sample:package:test-other:v1',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
        const srvDefinition = linkedModel.definitions["MyService"];
        appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
        const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig);

        expect(apiResourceTemplate).toMatchSnapshot();
    });

    it("should find ordId on circular relations", () => {
        linkedModel = cds.linked(`
                entity SecureApps {
                    key ID          : String;
                    components      : Association to many Components on components.app = $self;
                    issues          : Association to many Issues on issues.apps = $self;
                }

                @ODM.entityName: 'DirectCompositionOdmEntity'
                entity Components {
                    app            : Association to SecureApps;
                    incidents      : Association to many Incidents on incidents.component = $self;
                }

                @ODM.entityName: 'NestedCompositionOdmEntity'
                entity Incidents {
                    component       : Association to Components;
                    issues          : Association to many Issues on issues.incidents = $self;
                }

                entity Issues {
                    key ID          : String;
                    incidents       : Association to Incidents;
                    apps            : Association to SecureApps;
                }

                service MyService {
                    entity Apps as projection on SecureApps;
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService apiResource title',
                    shortDescription: 'short description for test MyService apiResource',
                    visibility : 'public',
                    version : '2.0.0',
                    partOfPackage : 'sap.test.cdsrc.sample:package:test-other:v1',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
        const srvDefinition = linkedModel.definitions["MyService"];
        appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
        const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig);

        expect(apiResourceTemplate).toMatchSnapshot();
    });

    it("should assign the correct partOfPackage for public API", () => {
        const serviceDefinition = {
            "@ORD.Extensions.visibility": "public",
            "entities": [],
            "name": "PublicAPI",
            "kind": "service",
        };

        const apiResource = createAPIResourceTemplate(serviceDefinition, appConfig);

        expect(apiResource).not.toBeNull();
        expect(apiResource[0].partOfPackage).toBe("customer.testNamespace:package:testAppName:v1");
    });

    it("should assign the correct partOfPackage for internal API", () => {
        const serviceDefinition = {
            "@ORD.Extensions.visibility": "internal",
            "entities": [],
            "name": "InternalAPI",
            "kind": "service",
        };

        const apiResource = createAPIResourceTemplate(serviceDefinition, appConfig);

        expect(apiResource).not.toBeNull();
        expect(apiResource[0].partOfPackage).toBe("customer.testNamespace:package:testAppName:v1");
    });

    it("should return null for private API", () => {
        const serviceDefinition = { "@ORD.Extensions.visibility": "private", "entities": [], "name": "PrivateAPI" };

        const apiResource = createAPIResourceTemplate(serviceDefinition, appConfig);

        expect(apiResource).toHaveLength(0);
    });

    describe("namespace local and global", () => {
        it("should strip application namespace from local namespace", () => {
            const appConfig = {
                ordNamespace: "customer.testNamespace",
                appName: "testAppName",
                packageName: "TestPackage",
                lastUpdate: "2022-12-19T15:47:04+00:00",
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
            };
            const model = cds.linked(`
                namespace customer.testNamespace.nested;

                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                };
                annotate MyService with @ORD.Extensions : {
                    visibility : 'public'
                };
            `);
            const srvDefinition = model.definitions["customer.testNamespace.nested.MyService"];
            expect(createAPIResourceTemplate(srvDefinition, appConfig)).toMatchSnapshot();
        });

        it("should strip application namespace if its the same as local namespace", () => {
            const appConfig = {
                ordNamespace: "customer.testNamespace",
                appName: "testAppName",
                packageName: "TestPackage",
                lastUpdate: "2022-12-19T15:47:04+00:00",
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
            };
            const model = cds.linked(`
                namespace customer.testNamespace;

                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                };
                annotate MyService with @ORD.Extensions : {
                    visibility : 'public'
                };
            `);
            const srvDefinition = model.definitions["customer.testNamespace.MyService"];
            expect(createAPIResourceTemplate(srvDefinition, appConfig)).toMatchSnapshot();
        });

        it("should not strip a different local namespace", () => {
            const appConfig = {
                ordNamespace: "customer.testNamespace",
                appName: "testAppName",
                packageName: "TestPackage",
                lastUpdate: "2022-12-19T15:47:04+00:00",
                accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
            };
            const model = cds.linked(`
                namespace other.namespace;

                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                };
                annotate MyService with @ORD.Extensions : {
                    visibility : 'public'
                };
            `);
            const srvDefinition = model.definitions["other.namespace.MyService"];
            expect(createAPIResourceTemplate(srvDefinition, appConfig)).toMatchSnapshot();
        });

        it("should strip internalNamespace when it differs from ordNamespace", () => {
            const appConfig = {
                ordNamespace: "sap.sourcing",
                internalNamespace: "com.sap.sourcing.api.v1",
                appName: "testAppName",
                packageName: "TestPackage",
                lastUpdate: "2022-12-19T15:47:04+00:00",
                authConfig: {
                    accessStrategies: [ORD_ACCESS_STRATEGY.Open],
                },
            };
            const model = cds.linked(`
            namespace com.sap.sourcing.api.v1;
            service SourcingService {
                entity Orders { key ID: UUID; }
            };
            annotate SourcingService with @ORD.Extensions : { visibility : 'public' };
        `);
            const srvDefinition = model.definitions["com.sap.sourcing.api.v1.SourcingService"];

            const apiResult = createAPIResourceTemplate(srvDefinition, appConfig);
            expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:SourcingService:v1");
            expect(apiResult[0].partOfGroups[0]).toBe("sap.cds:service:sap.sourcing:SourcingService");
        });

        it("should strip internalNamespace and handle leading dot for sub-namespaces", () => {
            const appConfig = {
                ordNamespace: "sap.sourcing",
                internalNamespace: "com.sap.sourcing",
                appName: "testAppName",
                packageName: "TestPackage",
                lastUpdate: "2022-12-19T15:47:04+00:00",
                authConfig: { accessStrategies: [ORD_ACCESS_STRATEGY.Open] },
            };
            const model = cds.linked(`
            namespace com.sap.sourcing.nested;
            service SourcingService {
                entity Orders { key ID: UUID; }
            };
            annotate SourcingService with @ORD.Extensions : { visibility : 'public' };
        `);
            const srvDefinition = model.definitions["com.sap.sourcing.nested.SourcingService"];

            const apiResult = createAPIResourceTemplate(srvDefinition, appConfig);
            expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:nested.SourcingService:v1");
        });

        it("should prefer internalNamespace over ordNamespace when both could match", () => {
            const appConfig = {
                ordNamespace: "sap.sourcing",
                internalNamespace: "sap.sourcing.internal",
                appName: "testAppName",
                packageName: "TestPackage",
                lastUpdate: "2022-12-19T15:47:04+00:00",
                authConfig: { accessStrategies: [ORD_ACCESS_STRATEGY.Open] },
            };
            const model = cds.linked(`
            namespace sap.sourcing.internal;
            service BillingService {
                entity Invoices { key ID: UUID; }
            };
            annotate BillingService with @ORD.Extensions : { visibility : 'public' };
        `);
            const srvDefinition = model.definitions["sap.sourcing.internal.BillingService"];

            const apiResult = createAPIResourceTemplate(srvDefinition, appConfig);
            expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:BillingService:v1");
        });

        it("should not strip a partial ordNamespace match (dot-boundary guard)", () => {
            const appConfig = {
                ordNamespace: "sap.sourcing",
                appName: "testAppName",
                packageName: "TestPackage",
                lastUpdate: "2022-12-19T15:47:04+00:00",
                authConfig: { accessStrategies: [ORD_ACCESS_STRATEGY.Open] },
            };
            const model = cds.linked(`
            namespace sap.sourcingExtra;
            service SomeService {
                entity Foo { key ID: UUID; }
            };
            annotate SomeService with @ORD.Extensions : { visibility : 'public' };
        `);
            const srvDefinition = model.definitions["sap.sourcingExtra.SomeService"];

            const apiResult = createAPIResourceTemplate(srvDefinition, appConfig);
            expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:sap.sourcingExtra.SomeService:v1");
        });

        it("should not strip a partial internalNamespace match (dot-boundary guard)", () => {
            const appConfig = {
                ordNamespace: "sap.sourcing",
                internalNamespace: "com.sap.sourcing",
                appName: "testAppName",
                packageName: "TestPackage",
                lastUpdate: "2022-12-19T15:47:04+00:00",
                authConfig: { accessStrategies: [ORD_ACCESS_STRATEGY.Open] },
            };
            const model = cds.linked(`
            namespace com.sap.sourcingExtra;
            service SomeService {
                entity Foo { key ID: UUID; }
            };
            annotate SomeService with @ORD.Extensions : { visibility : 'public' };
        `);
            const srvDefinition = model.definitions["com.sap.sourcingExtra.SomeService"];

            const apiResult = createAPIResourceTemplate(srvDefinition, appConfig);
            expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:com.sap.sourcingExtra.SomeService:v1");
        });

        it("should not strip when neither ordNamespace nor internalNamespace matches", () => {
            const appConfig = {
                ordNamespace: "sap.sourcing",
                internalNamespace: "com.sap.sourcing.api.v1",
                appName: "testAppName",
                packageName: "TestPackage",
                lastUpdate: "2022-12-19T15:47:04+00:00",
                authConfig: { accessStrategies: [ORD_ACCESS_STRATEGY.Open] },
            };
            const model = cds.linked(`
            namespace other.namespace;
            service MyService {
                entity Orders { key ID: UUID; }
            };
            annotate MyService with @ORD.Extensions : { visibility : 'public' };
        `);
            const srvDefinition = model.definitions["other.namespace.MyService"];

            const apiResult = createAPIResourceTemplate(srvDefinition, appConfig);
            expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:other.namespace.MyService:v1");
        });
    });

    describe("_getPackageID", () => {
        const packageIds = [
            "sap.test:package:test-entityType-public:v1",
            "sap.test:package:test-api-xyz:v1",
            "customer.testNamespace:package:fallback-package:v1",
        ];

        it("should use visibility-specific logic when resourceType is provided", () => {
            const result = _getPackageID("customer.testNamespace", packageIds, "entityType", "public");
            expect(result).toBe("sap.test:package:test-entityType-public:v1");
        });

        it("should use simple pattern when no visibility is specified", () => {
            const result = _getPackageID(
                "customer.testNamespace",
                ["sap.test:package:test-simple-entityType-match:v1"],
                "entityType",
            );
            expect(result).toBe("sap.test:package:test-simple-entityType-match:v1");
        });

        it("should use namespace fallback when no resourceType is provided", () => {
            const result = _getPackageID("customer.testNamespace", packageIds);
            expect(result).toBe("customer.testNamespace:package:fallback-package:v1");
        });
    });

    describe("Version Suffix Extraction for Data Product Services", () => {
        const mockAppConfig = {
            ordNamespace: "sap.test",
            appName: "sap.test",
            packageName: "TestPackage",
            lastUpdate: "2024-01-01T00:00:00Z",
            env: {
                defaultVisibility: "public",
            },
            authConfig: { accessStrategies: [ORD_ACCESS_STRATEGY.Open] },
        };

        describe("Positive Test Cases - Valid v<number> patterns", () => {
            test("should handle .v0 suffix correctly", () => {
                const serviceDefinition = {
                    name: "DataService.v0",
                    [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v0");
                expect(result[0].version).toBe("0.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
            });

            test("should handle .v1 suffix correctly", () => {
                const serviceDefinition = {
                    name: "DataService.v1",
                    [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v1");
                expect(result[0].version).toBe("1.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
            });

            test("should handle .v2 suffix correctly", () => {
                const serviceDefinition = {
                    name: "DataService.v2",
                    [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v2");
                expect(result[0].version).toBe("2.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
            });

            test("should handle .v10 suffix correctly", () => {
                const serviceDefinition = {
                    name: "DataService.v10",
                    [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v10");
                expect(result[0].version).toBe("10.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
            });

            test("should handle complex service names with .v1 suffix", () => {
                const serviceDefinition = {
                    name: "complex.DataProductService.v1",
                    [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:complex.DataProductService:v1");
                expect(result[0].version).toBe("1.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:complex.DataProductService");
            });
        });

        describe("Negative Test Cases - Invalid patterns", () => {
            test("should use current behavior for .v1.1 suffix (invalid pattern)", () => {
                const serviceDefinition = {
                    name: "DataService.v1.1",
                    [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService.v1.1:v1");
                expect(result[0].version).toBe("1.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.v1.1");
            });

            test("should use current behavior for .v1.0 suffix (invalid pattern)", () => {
                const serviceDefinition = {
                    name: "DataService.v1.0",
                    [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService.v1.0:v1");
                expect(result[0].version).toBe("1.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.v1.0");
            });

            test("should use current behavior for .version1 suffix (invalid pattern)", () => {
                const serviceDefinition = {
                    name: "DataService.version1",
                    [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService.version1:v1");
                expect(result[0].version).toBe("1.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.version1");
            });

            test("should use current behavior for .beta suffix (invalid pattern)", () => {
                const serviceDefinition = {
                    name: "DataService.beta",
                    [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService.beta:v1");
                expect(result[0].version).toBe("1.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.beta");
            });

            test("should use current behavior for .v suffix (invalid pattern)", () => {
                const serviceDefinition = {
                    name: "DataService.v",
                    [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService.v:v1");
                expect(result[0].version).toBe("1.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.v");
            });
        });

        describe("Edge Case Tests", () => {
            test("should use current behavior for data product service without version suffix", () => {
                const serviceDefinition = {
                    name: "DataService",
                    [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v1");
                expect(result[0].version).toBe("1.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
            });

            test("should use current behavior for non-data product service with valid version suffix", () => {
                const serviceDefinition = {
                    name: "RegularService.v2",
                    kind: "service",
                    // No DATA_PRODUCT_ANNOTATION - this is a regular service
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:RegularService.v2:v1");
                expect(result[0].version).toBe("1.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:RegularService.v2");
            });

            test("should use current behavior for non-primary data product service", () => {
                const serviceDefinition = {
                    name: "DataService.v2",
                    kind: "service",
                    [DATA_PRODUCT_ANNOTATION]: "secondary", // Not primary
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService.v2:v1");
                expect(result[0].version).toBe("1.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.v2");
            });
        });

        describe("Data Product Specific Properties", () => {
            test("should maintain data product specific properties with version extraction", () => {
                const serviceDefinition = {
                    name: "DataService.v2",
                    [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].direction).toBe("outbound");
                expect(result[0].apiProtocol).toBe("sap.dp:data-subscription-api:v1");
                expect(result[0].entryPoints).toEqual([]);
                expect(result[0].resourceDefinitions).toHaveLength(1);
                expect(result[0].resourceDefinitions[0].type).toBe("sap-csn-interop-effective-v1");
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v2");
                expect(result[0].version).toBe("2.0.0");
            });
        });

        describe("Tests with @data.product annotation", () => {
            test("should handle .v1 suffix correctly with @data.product annotation", () => {
                const serviceDefinition = {
                    name: "DataService.v1",
                    [DATA_PRODUCT_SIMPLE_ANNOTATION]: true,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v1");
                expect(result[0].version).toBe("1.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
                expect(result[0].direction).toBe("outbound");
                expect(result[0].apiProtocol).toBe("sap.dp:data-subscription-api:v1");
            });

            test("should handle .v2 suffix correctly with @data.product annotation", () => {
                const serviceDefinition = {
                    name: "DataService.v2",
                    [DATA_PRODUCT_SIMPLE_ANNOTATION]: "yes",
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v2");
                expect(result[0].version).toBe("2.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
            });

            test("should use current behavior when @data.product is false", () => {
                const serviceDefinition = {
                    name: "DataService.v2",
                    kind: "service",
                    [DATA_PRODUCT_SIMPLE_ANNOTATION]: false,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService.v2:v1");
                expect(result[0].version).toBe("1.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService.v2");
            });

            test("should prioritize @DataIntegration.dataProduct.type over @data.product for version extraction", () => {
                const serviceDefinition = {
                    name: "DataService.v3",
                    [DATA_PRODUCT_ANNOTATION]: DATA_PRODUCT_TYPE.primary,
                    [DATA_PRODUCT_SIMPLE_ANNOTATION]: false,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v3");
                expect(result[0].version).toBe("3.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
            });

            test("should apply @data.product when @DataIntegration.dataProduct.type is not primary", () => {
                const serviceDefinition = {
                    name: "DataService.v2",
                    [DATA_PRODUCT_ANNOTATION]: "secondary",
                    [DATA_PRODUCT_SIMPLE_ANNOTATION]: true,
                };

                const result = createAPIResourceTemplate(serviceDefinition, mockAppConfig);

                expect(result).toHaveLength(1);
                expect(result[0].ordId).toBe("sap.test:apiResource:DataService:v2");
                expect(result[0].version).toBe("2.0.0");
                expect(result[0].partOfGroups[0]).toBe("sap.cds:service:sap.test:DataService");
            });
        });
    });

    describe("createAPIResources", () => {
        const baseAppConfig = {
            ordNamespace: "customer.testNamespace",
            appName: "testAppName",
            packageName: "TestPackage",
            lastUpdate: "2022-12-19T15:47:04+00:00",
            policyLevels: ["none"],
            accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
        };

        it("should return API resources for all valid, non-events-only services", () => {
            const result = createAPIResources({
                ...baseAppConfig,
                csn: cds.linked(`
                    service ServiceA { entity Books { key ID: UUID; } }
                    service ServiceB { entity Orders { key ID: UUID; } }
                `),
            });

            expect(result.length).toBeGreaterThanOrEqual(2);
            expect(result.some((r) => r.ordId.includes("ServiceA"))).toBe(true);
            expect(result.some((r) => r.ordId.includes("ServiceB"))).toBe(true);
        });

        it("should return an empty array when there are no service definitions", () => {
            const result = createAPIResources({
                ...baseAppConfig,
                csn: cds.linked(`entity Books { key ID: UUID; }`),
            });

            expect(result).toEqual([]);
        });

        it("should exclude events-only services", () => {
            const result = createAPIResources({
                ...baseAppConfig,
                csn: cds.linked(`
                    service EventOnlyService { event OrderPlaced { ID: UUID; } }
                    service RegularService { entity Orders { key ID: UUID; } }
                `),
            });

            expect(result.some((r) => r.ordId.includes("RegularService"))).toBe(true);
            expect(result.some((r) => r.ordId.includes("EventOnlyService"))).toBe(false);
        });

        it("should exclude services annotated with @protocol: 'none'", () => {
            const result = createAPIResources({
                ...baseAppConfig,
                csn: cds.linked(`
                    @protocol: 'none'
                    service HiddenService { entity Items { key ID: UUID; } }
                    service VisibleService { entity Items { key ID: UUID; } }
                `),
            });

            expect(result.some((r) => r.ordId.includes("HiddenService"))).toBe(false);
            expect(result.some((r) => r.ordId.includes("VisibleService"))).toBe(true);
        });

        it("should exclude private services from the output", () => {
            const result = createAPIResources({
                ...baseAppConfig,
                csn: cds.linked(`
                    namespace customer.testNamespace;
                    service PrivateService { entity Items { key ID: UUID; } }
                    service PublicService { entity Items { key ID: UUID; } }
                    annotate PrivateService with @ORD.Extensions: { visibility: 'private' };
                `),
            });

            expect(result.some((r) => r.ordId.includes("PublicService"))).toBe(true);
            expect(result.some((r) => r.ordId.includes("PrivateService"))).toBe(false);
        });

        it("should return an empty array when all services are events-only", () => {
            const result = createAPIResources({
                ...baseAppConfig,
                csn: cds.linked(`
                    service EventsA { event Created { ID: UUID; } }
                    service EventsB { event Updated { ID: UUID; } }
                `),
            });

            expect(result).toEqual([]);
        });

        it("should properly replace placeholders in @ORD.Extensions.ordId", () => {
            const result = createAPIResources({
                ...appConfig,
                csn: cds.linked(`
                @ORD.Extensions.ordId: '{namespace}:{type}:MyService:v1'
                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                };
            `),
            });

            expect(result).toHaveLength(1);
            expect(result[0].resourceDefinitions).toHaveLength(2);
            expect(result[0].ordId).toBe("customer.testNamespace:apiResource:MyService:v1");
            expect(result[0].resourceDefinitions[0].url).toBe(
                "/ord/v1/customer.testNamespace:apiResource:MyService:v1/MyService.oas3.json",
            );
            expect(result[0].resourceDefinitions[1].url).toBe(
                "/ord/v1/customer.testNamespace:apiResource:MyService:v1/MyService.edmx",
            );
        });

        it("should properly replace placeholders in @ORD.Extensions.partOfPackage", () => {
            const result = createAPIResources({
                ...appConfig,
                csn: cds.linked(`
                @ORD.Extensions.partOfPackage: '{namespace}:{type}:Services:v1'
                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                };
            `),
            });

            expect(result).toHaveLength(1);
            expect(result[0].partOfPackage).toBe("customer.testNamespace:package:Services:v1");
        });
    });

    describe("getExposedEntityTypes", () => {
        it("should clean up duplicates", () => {
            const serviceDefinition = {
                entities: [{}, {}, {}],
            };
            serviceDefinition.entities[0][ORD_ODM_ENTITY_NAME_ANNOTATION] = "Something";
            serviceDefinition.entities[1][ENTITY_RELATIONSHIP_ANNOTATION] = "sap.sm:Else:v2";
            serviceDefinition.entities[2][ENTITY_RELATIONSHIP_ANNOTATION] = "sap.odm:Something";
            const exposedEntityTypes = _getExposedEntityTypes(serviceDefinition);
            expect(exposedEntityTypes).toMatchSnapshot();
            expect(exposedEntityTypes.length).toEqual(2);
        });
    });
});
