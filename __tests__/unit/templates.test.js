const cds = require("@sap/cds");

const {
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    ENTITY_RELATIONSHIP_ANNOTATION,
    ORD_EXTENSIONS_PREFIX,
    RESOURCE_VISIBILITY,
    ORD_ACCESS_STRATEGY,
} = require("../../lib/constants");
const {
    createEntityTypeTargetTemplate,
    createAPIResourceTemplate,
    _getExposedEntityTypes,
    _propagateORDVisibility,
} = require("../../lib/templates");

describe("templates", () => {
    let linkedModel;

    const appConfig = {
        ordNamespace: "customer.testNamespace",
        appName: "testAppName",
        lastUpdate: "2022-12-19T15:47:04+00:00",
        policyLevels: ["none"],
        authConfig: {
            accessStrategies: [ORD_ACCESS_STRATEGY.Open],
        },
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

    describe("createEntityTypeTargetTemplate", () => {
        it("should return default value", () => {
            expect(
                createEntityTypeTargetTemplate(linkedModel.definitions["customer.testNamespace123.Books"]),
            ).toBeUndefined();
        });

        it("returns two mapping objects with odm flag", () => {
            const model = cds.linked(`
                    namespace customer.dual;
                    @ODM.entityName: 'DualEntity'
                    @EntityRelationship.entityType: 'customer.dual:DualEntity'
                    entity DualEntity { key ID: UUID; name: String; }
                `);
            const entityDef = model.definitions["customer.dual.DualEntity"];
            const mappings = createEntityTypeTargetTemplate(entityDef);
            expect(mappings).toHaveLength(2);
            expect(mappings.map((m) => m.ordId)).toEqual(
                expect.arrayContaining(["sap.odm:entityType:DualEntity:v1", "customer.dual:entityType:DualEntity:v1"]),
            );
            const odm = mappings.find((m) => m.isODMMapping);
            const local = mappings.find((m) => !m.isODMMapping);
            expect(odm && odm.ordId).toBe("sap.odm:entityType:DualEntity:v1");
            expect(local && local.ordId).toBe("customer.dual:entityType:DualEntity:v1");
        });
    });

    describe("createAPIResourceTemplate", () => {
        it("should create API resource template correctly for multi-protocol services", () => {
            const model = cds.linked(`
                @rest
                @odata
                service MyService {}
            `);

            expect(
                createAPIResourceTemplate(model.definitions["MyService"], appConfig, [
                    "sap.test.cdsrc.sample:package:test-event:v1",
                    "sap.test.cdsrc.sample:package:test-api:v1",
                ]),
            ).toMatchSnapshot();
        });

        it("should create API resource template correctly for multi-protocol services when ordId is overridden for specific protocol", () => {
            const model = cds.linked(`
                @rest
                @odata
                @![protocol('rest')].ORD.Extensions.ordId: 'customer.testNamespace:apiResource:MyService-customized-rest:v1'
                service MyService {}
            `);

            expect(
                createAPIResourceTemplate(model.definitions["MyService"], appConfig, [
                    "sap.test.cdsrc.sample:package:test-event:v1",
                    "sap.test.cdsrc.sample:package:test-api:v1",
                ]),
            ).toMatchSnapshot();
        });

        it("should create API resource template correctly for multi-protocol services when ordId is overridden", () => {
            const model = cds.linked(`
                @rest
                @odata
                @ORD.Extensions.ordId: 'customer.testNamespace:apiResource:MyService-customized-odata-v4:v1'
                @![protocol('rest')].ORD.Extensions.ordId: 'customer.testNamespace:apiResource:MyService-customized-rest:v1'
                service MyService {}
            `);

            expect(
                createAPIResourceTemplate(model.definitions["MyService"], appConfig, [
                    "sap.test.cdsrc.sample:package:test-event:v1",
                    "sap.test.cdsrc.sample:package:test-api:v1",
                ]),
            ).toMatchSnapshot();
        });

        it("should return api resource with correct title from annotation '@EndUserText.label'", () => {
            const model = cds.linked(`service MyService @(EndUserText.label: 'This is MyService title' ) { }`);

            const apiResources = createAPIResourceTemplate(model.definitions["MyService"], appConfig, [
                "sap.test.cdsrc.sample:package:test-event:v1",
                "sap.test.cdsrc.sample:package:test-api:v1",
            ]);

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
            const srvDefinition = model.definitions["MyService"];
            const packageIds = [
                "sap.test.cdsrc.sample:package:test-event:v1",
                "sap.test.cdsrc.sample:package:test-api:v1",
            ];
            expect(createAPIResourceTemplate(srvDefinition, appConfig, packageIds)).toMatchSnapshot();
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
            const packageIds = [
                "sap.test.cdsrc.sample:package:test-event:v1",
                "sap.test.cdsrc.sample:package:test-api:v1",
            ];
            const srvDefinition = model.definitions["customer.testNamespace.MyService"];
            expect(createAPIResourceTemplate(srvDefinition, appConfig, packageIds)).toEqual([]);
        });

        describe("MCP protocol resource definitions", () => {
            const { MCP_RESOURCE_DEFINITION_TYPE } = require("../../lib/constants");

            it("should create correct resource definition for MCP protocol", () => {
                // CAP core doesn't recognize 'mcp' protocol (@protocol: 'mcp' returns empty endpoints)
                // Only added when plugin is there
                // So we need to mock the protocol resolver to test the MCP resource definition branch
                jest.resetModules();

                jest.doMock("../../lib/protocol-resolver", () => ({
                    resolveApiResourceProtocol: jest.fn().mockReturnValue([
                        {
                            apiProtocol: "mcp",
                            entryPoints: ["/mcp/mcp-service"],
                            hasResourceDefinitions: true,
                        },
                    ]),
                }));

                const { createAPIResourceTemplate: createAPIResourceTemplateMocked } = require("../../lib/templates");

                const model = cds.linked(`
                    service McpService {
                       entity Items {
                           key ID: UUID;
                           name: String;
                       }
                    };
                `);
                const srvDefinition = model.definitions["McpService"];
                const packageIds = ["sap.test.cdsrc.sample:package:test-api:v1"];
                const accessStrategies = [{ type: ORD_ACCESS_STRATEGY.Open }];

                const apiResourceTemplate = createAPIResourceTemplateMocked(
                    srvDefinition,
                    appConfig,
                    packageIds,
                    accessStrategies,
                );

                expect(apiResourceTemplate).toHaveLength(1);
                const mcpResource = apiResourceTemplate[0];
                expect(mcpResource.apiProtocol).toBe("mcp");
                expect(mcpResource.resourceDefinitions).toHaveLength(1);
                expect(mcpResource.resourceDefinitions[0].type).toBe(MCP_RESOURCE_DEFINITION_TYPE);
                expect(mcpResource.resourceDefinitions[0].mediaType).toBe("application/json");
                expect(mcpResource.resourceDefinitions[0].url).toContain(".mcp.json");

                jest.dontMock("../../lib/protocol-resolver");
                jest.resetModules();
            });
        });
    });

    describe("ordExtension", () => {
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
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig, packageIds);

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
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig, packageIds);

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
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig, packageIds);

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
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig, packageIds);

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
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig, packageIds);

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
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig, packageIds);

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
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(srvDefinition, appConfig, packageIds);

            expect(apiResourceTemplate).toMatchSnapshot();
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

    describe("propagateORDVisibility", () => {
        it("should propagate visibility private", () => {
            linkedModel = cds.linked(`
                entity AppCustomers {
                    key ID         : String;
                    addresses      : Composition of many Addresses on addresses.customer = $self;
                }

                @ODM.entityName: 'CompositionOdmEntity'
                entity Addresses {
                    customer       : Association to AppCustomers;
                }

                service MyService {
                    entity Customers as projection on AppCustomers;
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                }
                annotate MyService with @ORD.Extensions : {
                    visibility : 'private',
                };
            `);
            const model = _propagateORDVisibility(linkedModel);
            const eventDefinition = model.definitions["MyService.ServiceEvent"];
            expect(eventDefinition[ORD_EXTENSIONS_PREFIX + "visibility"]).toEqual(RESOURCE_VISIBILITY.private);
        });

        it("should propagate visibility internal", () => {
            linkedModel = cds.linked(`
                entity AppCustomers {
                    key ID         : String;
                    addresses      : Composition of many Addresses on addresses.customer = $self;
                }

                @ODM.entityName: 'CompositionOdmEntity'
                entity Addresses {
                    customer       : Association to AppCustomers;
                }

                service MyService {
                    entity Customers as projection on AppCustomers;
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                }
                annotate MyService with @ORD.Extensions : {
                    visibility : 'internal',
                };
            `);
            const model = _propagateORDVisibility(linkedModel);
            const eventDefinition = model.definitions["MyService.ServiceEvent"];
            expect(eventDefinition[ORD_EXTENSIONS_PREFIX + "visibility"]).toEqual(RESOURCE_VISIBILITY.internal);
        });

        it("should not propagate if there is no visibility annotation", () => {
            linkedModel = cds.linked(`
                entity AppCustomers {
                    key ID         : String;
                    addresses      : Composition of many Addresses on addresses.customer = $self;
                }

                @ODM.entityName: 'CompositionOdmEntity'
                entity Addresses {
                    customer       : Association to AppCustomers;
                }

                service MyService {
                    entity Customers as projection on AppCustomers;
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                }
            `);
            const model = _propagateORDVisibility(linkedModel);
            const eventDefinition = model.definitions["MyService.ServiceEvent"];
            expect(eventDefinition[ORD_EXTENSIONS_PREFIX + "visibility"]).toBeUndefined();
        });
    });
});
