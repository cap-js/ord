const cds = require("@sap/cds");
const {
    AUTHENTICATION_TYPE,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    ENTITY_RELATIONSHIP_ANNOTATION,
    ORD_EXTENSIONS_PREFIX,
    RESOURCE_VISIBILITY,
} = require("../../lib/constants");

jest.spyOn(cds, "context", "get").mockReturnValue({
    authConfig: {
        types: [AUTHENTICATION_TYPE.Open],
    },
});
const {
    createEntityTypeTemplate,
    createEntityTypeMappingsItemTemplate,
    createGroupsTemplateForService,
    createAPIResourceTemplate,
    createEventResourceTemplate,
    _getEntityTypeMappings,
    _propagateORDVisibility,
} = require("../../lib/templates");

describe("templates", () => {
    let linkedModel;
    let warningSpy;

    const appConfig = {
        ordNamespace: "customer.testNamespace",
        appName: "testAppName",
        lastUpdate: "2022-12-19T15:47:04+00:00",
        policyLevels: ["none"],
    };

    beforeAll(() => {
        linkedModel = cds.linked(`
            namespace customer.testNamespace123;
            entity Books {
                key ID: UUID;
                title: String;
            }
        `);
        warningSpy = jest.spyOn(console, "warn");
    });

    describe("createEntityTypeMappingsItemTemplate", () => {
        it("should return default value", () => {
            expect(
                createEntityTypeMappingsItemTemplate(linkedModel.definitions["customer.testNamespace123.Books"]),
            ).toBeUndefined();
        });
    });

    describe("createEntityTypeTemplate", () => {
        const packageIds = ["sap.test.cdsrc.sample:package:test-entityType:v1"];
        it("should return entity type with incorrect version, title and level:root-entity", () => {
            const entityWithVersion = {
                "ordId": "sap.sm:entityType:SomeAribaDummyEntity:v3b",
                "entityName": "SomeAribaDummyEntity",
                "@title": "Title of SomeAribaDummyEntity",
                "@ObjectModel.compositionRoot": true,
            };

            const entityType = createEntityTypeTemplate(appConfig, packageIds, entityWithVersion);
            expect(entityType).toBeDefined();
            expect(entityType).toMatchSnapshot();
            expect(warningSpy).toHaveBeenCalledTimes(1);
            expect(entityType.version).toEqual("3b.0.0");
            expect(entityType.level).toEqual("root-entity");
            expect(entityType.partOfPackage).toEqual("sap.test.cdsrc.sample:package:test-entityType:v1");
        });

        it("should return entity type with default version, title and level:sub-entity", () => {
            const entityWithoutVersion = {
                ordId: "sap.sm:entityType:SomeAribaDummyEntity:v1",
                entityName: "SomeAribaDummyEntity",
            };

            const entityType = createEntityTypeTemplate(appConfig, packageIds, entityWithoutVersion);
            expect(entityType).toBeDefined();
            expect(entityType).toMatchSnapshot();
            expect(entityType.version).toEqual("1.0.0");
            expect(entityType.level).toEqual("sub-entity");
        });

        it("should not entity types with SAP policy level as entity types should then be added through a central registry and we must not create an overlap", () => {
            const someEntity = {
                ordId: "sap.sm:entityType:SomeAribaDummyEntity:v1",
                entityName: "SomeAribaDummyEntity",
            };
            const appConfigWithSAPPolicy = {
                ...appConfig,
                policyLevels: ["sap:core:v1"],
            };

            const entityType = createEntityTypeTemplate(appConfigWithSAPPolicy, packageIds, someEntity);
            expect(entityType).toEqual([]);
        });
    });

    describe("createGroupsTemplateForService", () => {
        it("should return default value when groupIds do not have groupId", () => {
            const testServiceName = "testServiceName";
            const testResult = {
                groupId: "sap.cds:service:customer.testNamespace:testServiceName",
                groupTypeId: "sap.cds:service",
                title: "test Service",
            };
            expect(createGroupsTemplateForService(testServiceName, linkedModel, appConfig)).toEqual(testResult);
        });

        it('should return default value with a proper Service title when "Service" keyword is missing', () => {
            const testServiceName = "testServName";
            const testResult = {
                groupId: "sap.cds:service:customer.testNamespace:testServName",
                groupTypeId: "sap.cds:service",
                title: "testServName Service",
            };
            expect(createGroupsTemplateForService(testServiceName, linkedModel, appConfig)).toEqual(testResult);
        });

        it("should return undefined when no service definition", () => {
            const testServiceName = "testServiceName";
            expect(createGroupsTemplateForService(testServiceName, null, appConfig)).not.toBeDefined();
        });
    });

    describe("createAPIResourceTemplate", () => {
        it("should create API resource template correctly", () => {
            const serviceName = "MyService";
            const srvDefinition = linkedModel;
            const packageIds = [
                "sap.test.cdsrc.sample:package:test-event:v1",
                "sap.test.cdsrc.sample:package:test-api:v1",
            ];
            expect(createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });

        it("should not create API resource template when the visibility is private", () => {
            const serviceName = "MyService";
            const testNamespace = "customer.testNamespace.";
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
            const srvDefinition = model.definitions[testNamespace + serviceName];
            expect(createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toEqual([]);
        });
    });

    describe("createEventResourceTemplate", () => {
        it("should create event resource template correctly", () => {
            const serviceName = "MyService";
            const srvDefinition = linkedModel;
            const packageIds = [
                "sap.test.cdsrc.sample:package:test-event:v1",
                "sap.test.cdsrc.sample:package:test-api:v1",
            ];
            expect(createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });

        it("should create event resource template correctly with packageIds including namespace", () => {
            const serviceName = "MyService";
            const srvDefinition = linkedModel;
            const packageIds = ["customer.testNamespace:package:test:v1"];
            expect(createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });
    });

    describe("ordExtension", () => {
        it('should add apiResources with ORD Extension "visibility=public"', () => {
            const serviceName = "MyService";
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
                    visibility : 'public',
                    version : '2.0.0',
                    partOfPackage : 'sap.test.cdsrc.sample:package:test-other:v1',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
            const srvDefinition = linkedModel.definitions[serviceName];
            appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(apiResourceTemplate).toBeInstanceOf(Array);
            expect(apiResourceTemplate).toMatchSnapshot();
        });

        it("should include internal API resources but ensure they appear in a separate package", () => {
            const serviceName = "MyService";
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
            const srvDefinition = linkedModel.definitions[serviceName];
            appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(apiResourceTemplate).toBeInstanceOf(Array);
            expect(apiResourceTemplate).toMatchSnapshot();
            expect(apiResourceTemplate[0].visibility).toEqual("internal");
        });

        it('should not add apiResources with ORD Extension "visibility=private"', () => {
            const serviceName = "MyService";
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
            const srvDefinition = linkedModel.definitions[serviceName];
            appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(apiResourceTemplate).toBeInstanceOf(Array);
            expect(apiResourceTemplate).toMatchSnapshot();
            expect(apiResourceTemplate).toEqual([]);
        });

        it('should add events with ORD Extension "visibility=public"', () => {
            const serviceName = "MyService";
            linkedModel = cds.linked(`
                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService event title',
                    shortDescription: 'short description for test MyService event',
                    visibility : 'public',
                    version : '2.0.0',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
            const srvDefinition = linkedModel.definitions[serviceName];
            const packageIds = [
                "sap.test.cdsrc.sample:package:test-event:v1",
                "sap.test.cdsrc.sample:package:test-api:v1",
            ];
            const eventResourceTemplate = createEventResourceTemplate(
                serviceName,
                srvDefinition,
                appConfig,
                packageIds,
            );

            expect(eventResourceTemplate).toBeInstanceOf(Array);
            expect(eventResourceTemplate).toMatchSnapshot();
        });

        it("should include internal events but ensure they appear in a separate package", () => {
            const serviceName = "MyService";
            linkedModel = cds.linked(`
                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService event title',
                    shortDescription: 'short description for test MyService event',
                    visibility : 'internal',
                    version : '2.0.0',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
            const srvDefinition = linkedModel.definitions[serviceName];
            const packageIds = [
                "sap.test.cdsrc.sample:package:test-event-internal:v1",
                "sap.test.cdsrc.sample:package:test-api:v1",
            ];
            const eventResourceTemplate = createEventResourceTemplate(
                serviceName,
                srvDefinition,
                appConfig,
                packageIds,
            );

            expect(eventResourceTemplate).toBeInstanceOf(Array);
            expect(eventResourceTemplate).toMatchSnapshot();

            expect(eventResourceTemplate[0].visibility).toEqual("internal");
        });

        it('should not add events with ORD Extension "visibility=private"', () => {
            const serviceName = "MyService";
            linkedModel = cds.linked(`
                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                }
                annotate MyService with @ORD.Extensions : {
                    title           : 'This is test MyService event title',
                    shortDescription: 'short description for test MyService event',
                    visibility : 'private',
                    version : '2.0.0',
                    extensible : {
                        supported : 'yes'
                    }
                };
            `);
            const srvDefinition = linkedModel.definitions[serviceName];
            const packageIds = [
                "sap.test.cdsrc.sample:package:test-event:v1",
                "sap.test.cdsrc.sample:package:test-api:v1",
            ];
            const eventResourceTemplate = createEventResourceTemplate(
                serviceName,
                srvDefinition,
                appConfig,
                packageIds,
            );

            expect(eventResourceTemplate).toBeInstanceOf(Array);
            expect(eventResourceTemplate).toMatchSnapshot();
            expect(eventResourceTemplate).toEqual([]);
        });

        it("should find composition and association entities for related service", () => {
            const serviceName = "MyService";
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
            const srvDefinition = linkedModel.definitions[serviceName];
            appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(apiResourceTemplate).toMatchSnapshot();
        });

        it("should find association on nested entities for related service", () => {
            const serviceName = "MyService";
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
            const srvDefinition = linkedModel.definitions[serviceName];
            appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(apiResourceTemplate).toMatchSnapshot();
        });

        it("should find composition on nested entities for related service", () => {
            const serviceName = "MyService";
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
            const srvDefinition = linkedModel.definitions[serviceName];
            appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(apiResourceTemplate).toMatchSnapshot();
        });

        it("should find ordId on circular relations", () => {
            const serviceName = "MyService";
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
            const srvDefinition = linkedModel.definitions[serviceName];
            appConfig["entityTypeTargets"] = [{ ordId: "sap.odm:entityType:test:v1" }];
            const packageIds = ["customer.testNamespace:package:test:v1"];
            const apiResourceTemplate = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);

            expect(apiResourceTemplate).toMatchSnapshot();
        });
    });

    describe("getEntityTypeMappings", () => {
        it("should clean up duplicates", () => {
            const serviceDefinition = {
                entities: [{}, {}, {}],
            };
            serviceDefinition.entities[0][ORD_ODM_ENTITY_NAME_ANNOTATION] = "Something";
            serviceDefinition.entities[1][ENTITY_RELATIONSHIP_ANNOTATION] = "sap.sm:Else:v2";
            serviceDefinition.entities[2][ENTITY_RELATIONSHIP_ANNOTATION] = "sap.odm:Something";
            expect(_getEntityTypeMappings(serviceDefinition)).toMatchSnapshot();
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
