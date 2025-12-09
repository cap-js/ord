const cds = require("@sap/cds");
const {
    AUTHENTICATION_TYPE,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    ENTITY_RELATIONSHIP_ANNOTATION,
    ORD_EXTENSIONS_PREFIX,
    RESOURCE_VISIBILITY,
    ALLOWED_VISIBILITY,
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
    createMCPAPIResourceTemplate,
    _getEntityTypeMappings,
    _getExposedEntityTypes,
    _propagateORDVisibility,
    _handleVisibility,
    isPrimaryDataProductService,
} = require("../../lib/templates");

const { Logger } = require("../../lib/logger");

describe("visibility handling", () => {
    let loggerSpy;
    let appConfig;
    beforeEach(() => {
        loggerSpy = jest.spyOn(Logger, "warn").mockImplementation(() => {});
        appConfig = {
            ordNamespace: "customer.testNamespace",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
            policyLevels: ["none"],
            env: { defaultVisibility: "public" },
        };
    });
    afterEach(() => {
        loggerSpy.mockRestore();
    });

    it("returns internal for primary data product service", () => {
        const ordExtensions = {};
        const definition = { "@DataIntegration.dataProduct.type": "primary" };
        expect(_handleVisibility(ordExtensions, definition, RESOURCE_VISIBILITY.public)).toBe(
            RESOURCE_VISIBILITY.internal,
        );
    });

    it("returns extension visibility if present and valid", () => {
        const ordExtensions = { visibility: "internal" };
        const definition = {};
        expect(_handleVisibility(ordExtensions, definition, RESOURCE_VISIBILITY.public)).toBe("internal");
    });

    it("returns config value if valid", () => {
        const ordExtensions = {};
        const definition = {};
        expect(_handleVisibility(ordExtensions, definition, "public")).toBe("public");
    });

    it("falls back to public and logs warning for invalid config value", () => {
        const ordExtensions = {};
        const definition = {};
        expect(_handleVisibility(ordExtensions, definition, "notallowed")).toBe("public");

        expect(loggerSpy).toHaveBeenCalledWith(
            "Default visibility",
            "notallowed",
            "is not supported. Using",
            RESOURCE_VISIBILITY.public,
            "as fallback.",
        );
    });

    it("returns public for implementationStandard sap:ord-document-api:v1", () => {
        const ordExtensions = { implementationStandard: "sap:ord-document-api:v1" };
        const definition = {};
        expect(_handleVisibility(ordExtensions, definition, "private")).toBe("public");
        expect(_handleVisibility(ordExtensions, definition, "internal")).toBe("public");
    });

    it("returns definition[ORD_EXTENSIONS_PREFIX + visibility] if present", () => {
        const ordExtensions = {};
        const definition = { "@ORD.Extensions.visibility": "internal" };
        expect(_handleVisibility(ordExtensions, definition, "public")).toBe("internal");
    });

    it("returns public if no visibility is defined", () => {
        const ordExtensions = {};
        const definition = {};
        expect(_handleVisibility(ordExtensions, definition)).toBe("public");
    });

    it("Allowed visibility values are respected", () => {
        const ordExtensions = {};
        const definition = {};
        expect(ALLOWED_VISIBILITY).toContain(RESOURCE_VISIBILITY.public);
        expect(ALLOWED_VISIBILITY).toContain(RESOURCE_VISIBILITY.internal);
        expect(ALLOWED_VISIBILITY).toContain(RESOURCE_VISIBILITY.private);
        // Test with all allowed visibility values
        expect(_handleVisibility(ordExtensions, definition, RESOURCE_VISIBILITY.public)).toBe("public");
        expect(_handleVisibility(ordExtensions, definition, RESOURCE_VISIBILITY.private)).toBe("private");
        expect(_handleVisibility(ordExtensions, definition, RESOURCE_VISIBILITY.internal)).toBe("internal");
    });

    it("Does not use public visibility by deafult if implementationStandard is not in allowed values", () => {
        const ordExtensions = { implementationStandard: "I-AM-NOT-A-STANDARD" };
        const definition = {};
        expect(_handleVisibility(ordExtensions, definition, "private")).toBe("private");
        expect(_handleVisibility(ordExtensions, definition, "internal")).toBe("internal");
    });

    it("returns undefined if ORD.Extensions.visibility is private", () => {
        const serviceName = "customer.testNamespace.MyService";
        const serviceDefinition = {
            "name": serviceName,
            "@ORD.Extensions.visibility": "private",
        };
        const group = createGroupsTemplateForService(serviceName, serviceDefinition, appConfig);
        expect(group).toBeUndefined();
    });

    it("returns group object if ORD.Extensions.visibility is internal", () => {
        const serviceName = "customer.testNamespace.MyService";
        const serviceDefinition = {
            "name": serviceName,
            "@ORD.Extensions.visibility": "internal",
        };
        const group = createGroupsTemplateForService(serviceName, serviceDefinition, appConfig);
        expect(group).toEqual({
            groupId: "sap.cds:service:customer.testNamespace:MyService",
            groupTypeId: "sap.cds:service",
            title: "My Service",
        });
    });

    it("returns group object if ORD.Extensions.visibility is not set", () => {
        const serviceName = "customer.testNamespace.MyService";
        const serviceDefinition = { name: serviceName };
        const group = createGroupsTemplateForService(serviceName, serviceDefinition, appConfig);
        expect(group).toEqual({
            groupId: "sap.cds:service:customer.testNamespace:MyService",
            groupTypeId: "sap.cds:service",
            title: "My Service",
        });
    });

    describe("isPrimaryDataProductService", () => {
        it("returns true for @DataIntegration.dataProduct.type: 'primary'", () => {
            const serviceDefinition = { "@DataIntegration.dataProduct.type": "primary" };
            expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
        });

        it("returns false for @DataIntegration.dataProduct.type: 'secondary'", () => {
            const serviceDefinition = { "@DataIntegration.dataProduct.type": "secondary" };
            expect(isPrimaryDataProductService(serviceDefinition)).toBe(false);
        });

        it("returns true for @data.product with truthy value", () => {
            const serviceDefinition = { "@data.product": true };
            expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
        });

        it("returns true for @data.product with any truthy value", () => {
            const serviceDefinition = { "@data.product": "yes" };
            expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
        });

        it("returns false for @data.product with falsy value", () => {
            const serviceDefinition = { "@data.product": false };
            expect(isPrimaryDataProductService(serviceDefinition)).toBe(false);
        });

        it("returns false for service with no data product annotations", () => {
            const serviceDefinition = { "@title": "Regular Service" };
            expect(isPrimaryDataProductService(serviceDefinition)).toBe(false);
        });

        it("returns true when both annotations are present - @DataIntegration.dataProduct.type takes precedence", () => {
            const serviceDefinition = {
                "@DataIntegration.dataProduct.type": "primary",
                "@data.product": false,
            };
            expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
        });

        it("returns true when both annotations are present with @data.product truthy", () => {
            const serviceDefinition = {
                "@DataIntegration.dataProduct.type": "secondary",
                "@data.product": true,
            };
            expect(isPrimaryDataProductService(serviceDefinition)).toBe(true);
        });

        it("returns false when both annotations are present with falsy values", () => {
            const serviceDefinition = {
                "@DataIntegration.dataProduct.type": "secondary",
                "@data.product": false,
            };
            expect(isPrimaryDataProductService(serviceDefinition)).toBe(false);
        });
    });
});

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

        it("returns two mapping objects with odm flag", () => {
            const model = cds.linked(`
                    namespace customer.dual;
                    @ODM.entityName: 'DualEntity'
                    @EntityRelationship.entityType: 'customer.dual:DualEntity'
                    entity DualEntity { key ID: UUID; name: String; }
                `);
            const entityDef = model.definitions["customer.dual.DualEntity"];
            const mappings = createEntityTypeMappingsItemTemplate(entityDef);
            expect(mappings).toHaveLength(2);
            expect(mappings.map((m) => m.ordId)).toEqual(
                expect.arrayContaining(["sap.odm:entityType:DualEntity:v1", "customer.dual:entityType:DualEntity:v1"]),
            );
            const odm = mappings.find((m) => m.isODMMapping);
            const local = mappings.find((m) => !m.isODMMapping);
            expect(odm && odm.ordId).toBe("sap.odm:entityType:DualEntity:v1");
            expect(local && local.ordId).toBe("customer.dual:entityType:DualEntity:v1");
        });

        it("_getEntityTypeMappings collects both; only local becomes entityType", () => {
            const model = cds.linked(`
                    namespace customer.dualmapping;
                    @ODM.entityName: 'DualAuthors'
                    @EntityRelationship.entityType: 'customer.dualmapping:DualAuthors'
                    entity DualAuthors { key ID: UUID; title: String; }
                    service DualService { entity Authors as projection on DualAuthors; }
                `);
            const serviceDef = model.definitions["customer.dualmapping.DualService"];
            const mappingsWrapper = _getEntityTypeMappings(serviceDef);
            const targets = mappingsWrapper[0].entityTypeTargets.map((t) => t.ordId);
            expect(targets).toEqual(
                expect.arrayContaining([
                    "sap.odm:entityType:DualAuthors:v1",
                    "customer.dualmapping:entityType:DualAuthors:v1",
                ]),
            );

            const mappingItems = createEntityTypeMappingsItemTemplate(
                model.definitions["customer.dualmapping.DualAuthors"],
            );
            const arr = Array.isArray(mappingItems) ? mappingItems : [mappingItems];
            const entityTypes = arr
                .flatMap((e) => createEntityTypeTemplate(appConfig, ["customer.dualmapping:package:dual:v1"], e))
                .filter(Boolean);
            expect(entityTypes).toHaveLength(1);
            expect(entityTypes[0].ordId).toBe("customer.dualmapping:entityType:DualAuthors:v1");
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
        let serviceDefinition;
        beforeAll(() => {
            const model = cds.linked(`
                service testServiceName {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                };
            `);
            serviceDefinition = model.definitions["testServiceName"];
        });

        it("should return default value when groupIds do not have groupId", () => {
            const testServiceName = "testServiceName";
            const testResult = {
                groupId: "sap.cds:service:customer.testNamespace:testServiceName",
                groupTypeId: "sap.cds:service",
                title: "test Service",
            };
            expect(createGroupsTemplateForService(testServiceName, serviceDefinition, appConfig)).toEqual(testResult);
        });

        it('should return default value with a proper Service title when "Service" keyword is missing', () => {
            const testServiceName = "testServName";
            const testResult = {
                groupId: "sap.cds:service:customer.testNamespace:testServiceName",
                groupTypeId: "sap.cds:service",
                title: "testServName Service",
            };
            expect(createGroupsTemplateForService(testServiceName, serviceDefinition, appConfig)).toEqual(testResult);
        });

        it("should return undefined when no service definition", () => {
            const testServiceName = "testServiceName";
            expect(createGroupsTemplateForService(testServiceName, null, appConfig)).not.toBeDefined();
        });
    });

    describe("createAPIResourceTemplate", () => {
        it("should create API resource template correctly", () => {
            const serviceName = "MyService";
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
            expect(createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });

        it("should create event resource template correctly with packageIds including namespace", () => {
            const serviceName = "MyService";
            const model = cds.linked(`
                service MyService {
                   entity Books {
                       key ID: UUID;
                       title: String;
                   }
                };
            `);
            const srvDefinition = model.definitions["MyService"];
            const packageIds = ["customer.testNamespace:package:test:v1"];
            expect(createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        });
    });

    describe("createMCPAPIResourceTemplate", () => {
        it("should create MCP API resource template correctly", () => {
            // Mock MCP plugin to return null metadata (test default values)
            jest.mock(
                "@btp-ai/mcp-plugin/lib/utils/metadata",
                () => ({
                    generateORDMetadata: jest.fn(() => null),
                }),
                { virtual: true },
            );

            const packageIds = ["customer.testNamespace:package:api:v1"];
            const accessStrategies = [{ type: "open" }];

            const result = createMCPAPIResourceTemplate(appConfig, packageIds, accessStrategies);

            // Snapshot added for regression tracking of MCP template structure
            expect(result).toMatchSnapshot();
            // Keep explicit structural equality to fail fast on critical changes
            expect(result).toEqual({
                ordId: "customer.testNamespace:apiResource:mcp-server:v1",
                title: "MCP Server for testAppName",
                shortDescription: "This is the MCP server to interact with the testAppName",
                description: "This is the MCP server to interact with the testAppName",
                version: "1.0.0",
                lastUpdate: "2022-12-19T15:47:04+00:00",
                visibility: "public",
                partOfPackage: "customer.testNamespace:package:api:v1",
                releaseStatus: "active",
                apiProtocol: "mcp",
                resourceDefinitions: [
                    {
                        type: "custom",
                        mediaType: "application/json",
                        url: "/ord/v1/customer.testNamespace:apiResource:mcp-server:v1/mcp-server-definition.mcp.json",
                        accessStrategies: [{ type: "open" }],
                    },
                ],
                entryPoints: ["/rest/mcp/streaming"],
                extensible: { supported: "no" },
            });
        });

        it("should handle visibility-based ordId generation correctly", () => {
            // Test the core functionality by verifying ordId patterns for different visibilities
            const packageIds = ["customer.testNamespace:package:api:v1"];
            const accessStrategies = [{ type: "open" }];

            // Test default behavior (public visibility)
            const result = createMCPAPIResourceTemplate(appConfig, packageIds, accessStrategies);
            expect(result.ordId).toBe("customer.testNamespace:apiResource:mcp-server:v1");
            expect(result.visibility).toBe("public");
        });

        it("should handle array vs single object return correctly", () => {
            // Test that the function can handle both single objects and arrays
            const packageIds = ["customer.testNamespace:package:api:v1"];
            const accessStrategies = [{ type: "open" }];

            // Test default behavior (returns single object)
            const result = createMCPAPIResourceTemplate(appConfig, packageIds, accessStrategies);
            expect(Array.isArray(result)).toBe(false);
            expect(result).toHaveProperty("ordId");
            expect(result).toHaveProperty("title");
            expect(result).toHaveProperty("visibility");
        });

        it("should maintain backward compatibility with existing behavior", () => {
            // Test that existing behavior is preserved when plugin is not ready
            const packageIds = ["customer.testNamespace:package:api:v1"];
            const accessStrategies = [{ type: "open" }];

            // Mock plugin not ready (existing behavior)
            const mcpAdapterSpy = jest.spyOn(require("../../lib/mcpAdapter"), "isMCPPluginReady");
            mcpAdapterSpy.mockReturnValue(false);

            const result = createMCPAPIResourceTemplate(appConfig, packageIds, accessStrategies);

            // Should return single object with default values
            expect(Array.isArray(result)).toBe(false);
            expect(result.ordId).toBe("customer.testNamespace:apiResource:mcp-server:v1");
            expect(result.title).toBe("MCP Server for testAppName");
            expect(result.visibility).toBe("public");

            // Clean up
            mcpAdapterSpy.mockRestore();
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
