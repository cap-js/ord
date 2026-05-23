const cds = require("@sap/cds");

const { createEventResourceTemplate, RESOLVERS } = require("../../../lib/templates/event-resource");
const {
    RESOURCE_VISIBILITY,
    ENTITY_RELATIONSHIP_ANNOTATION,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    ORD_ACCESS_STRATEGY,
} = require("../../../lib/constants");

const BASE_SERVICE = {
    name: "TestEventService",
    entities: {},
};

const BASE_APP_CONFIG = {
    ordNamespace: "sap.test",
    appName: "TestApp",
    lastUpdate: "2024-01-01T00:00:00+00:00",
    env: { defaultVisibility: RESOURCE_VISIBILITY.public },
    authConfig: { accessStrategies: ["open"] },
};

describe("RESOLVERS.version", () => {
    it("defaults to 1.0.0 when no extension is set", () => {
        expect(RESOLVERS.version(BASE_SERVICE)).toBe("1.0.0");
    });

    it("uses @ORD.Extensions.version when set", () => {
        const service = { ...BASE_SERVICE, "@ORD.Extensions.version": "3.2.1" };
        expect(RESOLVERS.version(service)).toBe("3.2.1");
    });
});

describe("RESOLVERS.description", () => {
    it("returns the default description when no annotation is present", () => {
        expect(RESOLVERS.description(BASE_SERVICE)).toBe("CAP Event resource describing events / messages.");
    });

    it("prefers @ORD.Extensions.description", () => {
        const service = { ...BASE_SERVICE, "@ORD.Extensions.description": "Custom description" };
        expect(RESOLVERS.description(service)).toBe("Custom description");
    });

    it("prefers @description over @Core.Description", () => {
        const service = { ...BASE_SERVICE, "@description": "Desc Ann", "@Core.Description": "Core" };
        expect(RESOLVERS.description(service)).toBe("Desc Ann");
    });

    it("uses @Core.Description when it is the only description annotation", () => {
        const service = { ...BASE_SERVICE, "@Core.Description": "Core description" };
        expect(RESOLVERS.description(service)).toBe("Core description");
    });
});

describe("RESOLVERS.ordId", () => {
    it("builds ordId from namespace, resource type, and service name", () => {
        expect(RESOLVERS.ordId(BASE_SERVICE, BASE_APP_CONFIG)).toBe("sap.test:eventResource:TestEventService:v1");
    });

    it("uses major version from @ORD.Extensions.version", () => {
        const service = { ...BASE_SERVICE, "@ORD.Extensions.version": "3.2.1" };
        expect(RESOLVERS.ordId(service, BASE_APP_CONFIG)).toBe("sap.test:eventResource:TestEventService:v3");
    });

    it("strips namespace prefix from service name when it matches ordNamespace", () => {
        const service = { ...BASE_SERVICE, name: "sap.test.TestEventService" };
        expect(RESOLVERS.ordId(service, BASE_APP_CONFIG)).toBe("sap.test:eventResource:TestEventService:v1");
    });

    it("prefers @ORD.Extensions.ordId when set", () => {
        const service = { ...BASE_SERVICE, "@ORD.Extensions.ordId": "sap.test:eventResource:custom:v2" };
        expect(RESOLVERS.ordId(service, BASE_APP_CONFIG)).toBe("sap.test:eventResource:custom:v2");
    });
});

describe("RESOLVERS.title", () => {
    it("falls back to a generated title using appName when no annotation is present", () => {
        expect(RESOLVERS.title(BASE_SERVICE, BASE_APP_CONFIG)).toBe("ODM TestApp Events");
    });

    it("strips non-alphanumeric characters from appName in fallback title", () => {
        const appConfig = { ...BASE_APP_CONFIG, appName: "My App-Name!" };
        expect(RESOLVERS.title(BASE_SERVICE, appConfig)).toBe("ODM MyAppName Events");
    });

    it("prefers @ORD.Extensions.title", () => {
        const service = { ...BASE_SERVICE, "@ORD.Extensions.title": "My Events" };
        expect(RESOLVERS.title(service, BASE_APP_CONFIG)).toBe("My Events");
    });

    it("prefers @title over @Common.Label", () => {
        const service = { ...BASE_SERVICE, "@title": "Title Ann", "@Common.Label": "Common" };
        expect(RESOLVERS.title(service, BASE_APP_CONFIG)).toBe("Title Ann");
    });

    it("uses @Common.Label when @title is absent", () => {
        const service = { ...BASE_SERVICE, "@Common.Label": "Common Label" };
        expect(RESOLVERS.title(service, BASE_APP_CONFIG)).toBe("Common Label");
    });

    it("uses @EndUserText.label when it is the only title annotation", () => {
        const service = { ...BASE_SERVICE, "@EndUserText.label": "End User" };
        expect(RESOLVERS.title(service, BASE_APP_CONFIG)).toBe("End User");
    });
});

describe("RESOLVERS.exposedEntityTypes", () => {
    it("returns empty array when service has no entities", () => {
        expect(RESOLVERS.exposedEntityTypes(BASE_SERVICE)).toEqual([]);
    });

    it("includes ODM entity type ordId when @ODM.entityName is set", () => {
        const service = {
            ...BASE_SERVICE,
            entities: {
                BPEntity: { [ORD_ODM_ENTITY_NAME_ANNOTATION]: "BusinessPartner" },
            },
        };
        expect(RESOLVERS.exposedEntityTypes(service)).toEqual([{ ordId: "sap.odm:entityType:BusinessPartner:v1" }]);
    });

    it("includes entity type ordId when @EntityRelationship.entityType is set", () => {
        const service = {
            ...BASE_SERVICE,
            entities: {
                BPEntity: { [ENTITY_RELATIONSHIP_ANNOTATION]: "sap.test:BusinessPartner:v1" },
            },
        };
        expect(RESOLVERS.exposedEntityTypes(service)).toEqual([{ ordId: "sap.test:entityType:BusinessPartner:v1" }]);
    });

    it("deduplicates ordIds across entities", () => {
        const entity = { [ORD_ODM_ENTITY_NAME_ANNOTATION]: "BusinessPartner" };
        const service = {
            ...BASE_SERVICE,
            entities: { E1: entity, E2: entity },
        };
        expect(RESOLVERS.exposedEntityTypes(service)).toEqual([{ ordId: "sap.odm:entityType:BusinessPartner:v1" }]);
    });

    it("includes both ODM and entity relationship ordIds when both annotations are present", () => {
        const service = {
            ...BASE_SERVICE,
            entities: {
                BPEntity: {
                    [ORD_ODM_ENTITY_NAME_ANNOTATION]: "BusinessPartner",
                    [ENTITY_RELATIONSHIP_ANNOTATION]: "sap.test:BusinessPartner:v1",
                },
            },
        };
        const result = RESOLVERS.exposedEntityTypes(service);
        expect(result).toEqual(
            expect.arrayContaining([
                { ordId: "sap.odm:entityType:BusinessPartner:v1" },
                { ordId: "sap.test:entityType:BusinessPartner:v1" },
            ]),
        );
        expect(result).toHaveLength(2);
    });
});

describe("RESOLVERS.visibility", () => {
    it("defaults to public from appConfig env", () => {
        expect(RESOLVERS.visibility(BASE_SERVICE, BASE_APP_CONFIG)).toBe(RESOURCE_VISIBILITY.public);
    });

    it("defaults to public when appConfig.env is absent", () => {
        expect(RESOLVERS.visibility(BASE_SERVICE, { ...BASE_APP_CONFIG, env: undefined })).toBe(
            RESOURCE_VISIBILITY.public,
        );
    });

    it("uses appConfig.env.defaultVisibility when no entity override", () => {
        const appConfig = { ...BASE_APP_CONFIG, env: { defaultVisibility: RESOURCE_VISIBILITY.internal } };
        expect(RESOLVERS.visibility(BASE_SERVICE, appConfig)).toBe(RESOURCE_VISIBILITY.internal);
    });

    it("prefers @ORD.Extensions.visibility over appConfig default", () => {
        const service = { ...BASE_SERVICE, "@ORD.Extensions.visibility": RESOURCE_VISIBILITY.private };
        expect(RESOLVERS.visibility(service, BASE_APP_CONFIG)).toBe(RESOURCE_VISIBILITY.private);
    });
});

describe("RESOLVERS.partOfGroups", () => {
    it("builds group id from groupTypeId, namespace, and service name", () => {
        expect(RESOLVERS.partOfGroups(BASE_SERVICE, BASE_APP_CONFIG)).toEqual([
            "sap.cds:service:sap.test:TestEventService",
        ]);
    });

    it("strips namespace prefix from service name", () => {
        const service = { ...BASE_SERVICE, name: "sap.test.TestEventService" };
        expect(RESOLVERS.partOfGroups(service, BASE_APP_CONFIG)).toEqual(["sap.cds:service:sap.test:TestEventService"]);
    });
});

describe("RESOLVERS.partOfPackage", () => {
    it("resolves to the general package for a public service without SAP policy level", () => {
        const result = RESOLVERS.partOfPackage(BASE_SERVICE, BASE_APP_CONFIG);
        expect(result).toBe("sap.test:package:TestApp:v1");
    });

    it("resolves to the event-specific package when hasSAPPolicyLevel is true", () => {
        const appConfig = { ...BASE_APP_CONFIG, hasSAPPolicyLevel: true };
        const result = RESOLVERS.partOfPackage(BASE_SERVICE, appConfig);
        expect(result).toBe("sap.test:package:TestApp-event:v1");
    });

    it("strips non-alphanumeric characters from appName", () => {
        const appConfig = { ...BASE_APP_CONFIG, hasSAPPolicyLevel: true, appName: "My App-Name!" };
        const result = RESOLVERS.partOfPackage(BASE_SERVICE, appConfig);
        expect(result).toBe("sap.test:package:MyAppName-event:v1");
    });

    it("prefers @ORD.Extensions.partOfPackage when set", () => {
        const service = { ...BASE_SERVICE, "@ORD.Extensions.partOfPackage": "sap.test:package:custom:v1" };
        expect(RESOLVERS.partOfPackage(service, BASE_APP_CONFIG)).toBe("sap.test:package:custom:v1");
    });
});

describe("RESOLVERS.resourceDefinitions", () => {
    it("returns a single asyncapi-v2 resource definition", () => {
        const result = RESOLVERS.resourceDefinitions(BASE_SERVICE, BASE_APP_CONFIG);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("asyncapi-v2");
        expect(result[0].mediaType).toBe("application/json");
    });

    it("builds url from ordId and service name", () => {
        const ordId = RESOLVERS.ordId(BASE_SERVICE, BASE_APP_CONFIG);
        const result = RESOLVERS.resourceDefinitions(BASE_SERVICE, BASE_APP_CONFIG);
        expect(result[0].url).toBe(`/ord/v1/${ordId}/${BASE_SERVICE.name}.asyncapi2.json`);
    });

    it("includes accessStrategies from authConfig", () => {
        const appConfig = { ...BASE_APP_CONFIG, authConfig: { accessStrategies: ["open"] } };
        const result = RESOLVERS.resourceDefinitions(BASE_SERVICE, appConfig);
        expect(result[0].accessStrategies).toEqual([{ type: "open" }]);
    });
});

describe("createEventResourceTemplate", () => {
    const appConfig = {
        ordNamespace: "customer.testNamespace",
        appName: "testAppName",
        lastUpdate: "2022-12-19T15:47:04+00:00",
        policyLevels: ["none"],
        authConfig: {
            accessStrategies: [ORD_ACCESS_STRATEGY.Open],
        },
    };

    it("produces a complete event resource object with defaults", () => {
        const result = createEventResourceTemplate(BASE_SERVICE, BASE_APP_CONFIG);
        expect(result).toEqual({
            ordId: "sap.test:eventResource:TestEventService:v1",
            title: "ODM TestApp Events",
            version: "1.0.0",
            description: "CAP Event resource describing events / messages.",
            shortDescription: "TestEventService event resource",
            releaseStatus: "active",
            extensible: { supported: "no" },
            lastUpdate: "2024-01-01T00:00:00+00:00",
            visibility: RESOURCE_VISIBILITY.public,
            partOfGroups: ["sap.cds:service:sap.test:TestEventService"],
            partOfPackage: "sap.test:package:TestApp:v1",
            resourceDefinitions: [
                {
                    type: "asyncapi-v2",
                    mediaType: "application/json",
                    url: "/ord/v1/sap.test:eventResource:TestEventService:v1/TestEventService.asyncapi2.json",
                    accessStrategies: [{ type: "open" }],
                },
            ],
        });
    });

    it("omits exposedEntityTypes when service has no entities with annotations", () => {
        const result = createEventResourceTemplate(BASE_SERVICE, BASE_APP_CONFIG);
        expect(result).not.toHaveProperty("exposedEntityTypes");
    });

    it("includes exposedEntityTypes when entities carry ODM annotations", () => {
        const service = {
            ...BASE_SERVICE,
            entities: {
                BPEntity: { [ORD_ODM_ENTITY_NAME_ANNOTATION]: "BusinessPartner" },
            },
        };
        const result = createEventResourceTemplate(service, BASE_APP_CONFIG);
        expect(result.exposedEntityTypes).toEqual([{ ordId: "sap.odm:entityType:BusinessPartner:v1" }]);
    });

    it("merges ORD extensions onto the result", () => {
        const service = {
            ...BASE_SERVICE,
            "@ORD.Extensions.title": "My Events",
            "@ORD.Extensions.releaseStatus": "beta",
        };
        const result = createEventResourceTemplate(service, BASE_APP_CONFIG);
        expect(result.title).toBe("My Events");
        expect(result.releaseStatus).toBe("beta");
    });

    it("should create event resource template correctly", () => {
        const model = cds.linked(`
                service MyService {
                   entity Books {
                       key ID: UUID;
                       title: String;
                   }
                };
            `);
        const srvDefinition = model.definitions["MyService"];

        expect(createEventResourceTemplate(srvDefinition, appConfig)).toMatchSnapshot();
    });

    it("should create event resource template correctly with packageIds including namespace", () => {
        const model = cds.linked(`
                service MyService {
                   entity Books {
                       key ID: UUID;
                       title: String;
                   }
                };
            `);
        const srvDefinition = model.definitions["MyService"];

        expect(createEventResourceTemplate(srvDefinition, appConfig)).toMatchSnapshot();
    });

    it("should return event resource with correct title from annotation '@EndUserText.label'", () => {
        const serviceName = "MyService";
        const linkedModel = cds.linked(`
                @EndUserText.label: 'This is test MyService event title'
                service MyService { }
            `);
        const eventResourceTemplate = createEventResourceTemplate(linkedModel.definitions[serviceName], appConfig);

        expect(eventResourceTemplate.title).toEqual("This is test MyService event title");
    });

    it('should add events with ORD Extension "visibility=public"', () => {
        const linkedModel = cds.linked(`
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
        const srvDefinition = linkedModel.definitions["MyService"];
        const eventResourceTemplate = createEventResourceTemplate(srvDefinition, appConfig);

        expect(eventResourceTemplate).toMatchSnapshot();
    });

    it("should include internal events but ensure they appear in a separate package", () => {
        const linkedModel = cds.linked(`
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
        const srvDefinition = linkedModel.definitions["MyService"];
        const eventResourceTemplate = createEventResourceTemplate(srvDefinition, appConfig);

        expect(eventResourceTemplate).toMatchSnapshot();

        expect(eventResourceTemplate.visibility).toEqual("internal");
    });

    it("should assign the correct partOfPackage for public Event", () => {
        const serviceDefinition = { "@ORD.Extensions.visibility": "public", "entities": [], "name": "PublicEvent" };

        const eventResource = createEventResourceTemplate(serviceDefinition, appConfig);

        expect(eventResource.partOfPackage).toBe("customer.testNamespace:package:testAppName:v1");
    });

    it("should assign the correct partOfPackage for internal Event", () => {
        const serviceDefinition = {
            "@ORD.Extensions.visibility": "internal",
            "entities": [],
            "name": "InternalEvent",
        };

        const eventResource = createEventResourceTemplate(serviceDefinition, appConfig);

        expect(eventResource.partOfPackage).toBe("customer.testNamespace:package:testAppName:v1");
    });

    it("should strip application namespace from local namespace", () => {
        const appConfig = {
            ordNamespace: "customer.testNamespace",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
            authConfig: {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            },
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

        expect(
            createEventResourceTemplate(model.definitions["customer.testNamespace.nested.MyService"], appConfig),
        ).toMatchSnapshot();
    });

    it("should strip application namespace if its the same as local namespace", () => {
        const appConfig = {
            ordNamespace: "customer.testNamespace",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
            authConfig: {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            },
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

        expect(
            createEventResourceTemplate(model.definitions["customer.testNamespace.MyService"], appConfig),
        ).toMatchSnapshot();
    });

    it("should not strip a different local namespace", () => {
        const appConfig = {
            ordNamespace: "customer.testNamespace",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
            authConfig: {
                accessStrategies: [ORD_ACCESS_STRATEGY.Open],
            },
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

        expect(
            createEventResourceTemplate(model.definitions["other.namespace.MyService"], appConfig),
        ).toMatchSnapshot();
    });

    it("should strip internalNamespace when it differs from ordNamespace", () => {
        const appConfig = {
            ordNamespace: "sap.sourcing",
            internalNamespace: "com.sap.sourcing.api.v1",
            appName: "testAppName",
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

        const eventResult = createEventResourceTemplate(
            model.definitions["com.sap.sourcing.api.v1.SourcingService"],
            appConfig,
        );

        expect(eventResult.ordId).toBe("sap.sourcing:eventResource:SourcingService:v1");
    });
});
