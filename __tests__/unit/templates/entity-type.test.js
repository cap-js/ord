const Logger = require("../../../lib/logger");
const { createEntityTypeTemplate, RESOLVERS } = require("../../../lib/templates/entity-type");
const {
    LEVEL,
    RESOURCE_VISIBILITY,
    ORD_ACCESS_STRATEGY,
    ENTITY_RELATIONSHIP_ANNOTATION,
} = require("../../../lib/constants");

const BASE_ENTITY = {
    [ENTITY_RELATIONSHIP_ANNOTATION]: "sap.test:BusinessPartner:v1",
};

const BASE_APP_CONFIG = {
    ordNamespace: "sap.test",
    appName: "TestApp",
    lastUpdate: "2024-01-01T00:00:00+00:00",
    env: { defaultVisibility: RESOURCE_VISIBILITY.public },
};

describe("RESOLVERS.ordId", () => {
    it("builds ordId from entity relationship annotation", () => {
        expect(RESOLVERS.ordId(BASE_ENTITY)).toBe("sap.test:entityType:BusinessPartner:v1");
    });

    it("uses @ORD.Extensions.version major over annotation version", () => {
        const entity = {
            [ENTITY_RELATIONSHIP_ANNOTATION]: "sap.test:BusinessPartner:v1",
            "@ORD.Extensions.version": "3.2.1",
        };
        expect(RESOLVERS.ordId(entity)).toBe("sap.test:entityType:BusinessPartner:v3");
    });

    it("falls back to '1' when annotation has no version segment", () => {
        const entity = { [ENTITY_RELATIONSHIP_ANNOTATION]: "sap.test:BusinessPartner" };
        expect(RESOLVERS.ordId(entity)).toBe("sap.test:entityType:BusinessPartner:v1");
    });
});

describe("RESOLVERS.localId", () => {
    it("extracts name segment from entity relationship annotation", () => {
        expect(RESOLVERS.localId(BASE_ENTITY)).toBe("BusinessPartner");
    });

    it("prefers @ORD.Extensions.localId when set", () => {
        const entity = {
            ...BASE_ENTITY,
            "@ORD.Extensions.localId": "CustomLocalId",
        };
        expect(RESOLVERS.localId(entity)).toBe("CustomLocalId");
    });
});

describe("RESOLVERS.title", () => {
    it("falls back to localId when no title annotation is present", () => {
        expect(RESOLVERS.title(BASE_ENTITY)).toBe("BusinessPartner");
    });

    it("prefers @ORD.Extensions.title", () => {
        expect(RESOLVERS.title({ ...BASE_ENTITY, "@ORD.Extensions.title": "My Title" })).toBe("My Title");
    });

    it("prefers @title over @Common.Label", () => {
        const entity = { ...BASE_ENTITY, "@title": "Title Ann", "@Common.Label": "Common" };
        expect(RESOLVERS.title(entity)).toBe("Title Ann");
    });

    it("prefers @Common.Label over @EndUserText.label", () => {
        const entity = { ...BASE_ENTITY, "@Common.Label": "Common", "@EndUserText.label": "EndUser" };
        expect(RESOLVERS.title(entity)).toBe("Common");
    });

    it("uses @EndUserText.label when it is the only title annotation", () => {
        const entity = { ...BASE_ENTITY, "@EndUserText.label": "EndUser" };
        expect(RESOLVERS.title(entity)).toBe("EndUser");
    });
});

describe("RESOLVERS.level", () => {
    it("returns sub-entity by default", () => {
        expect(RESOLVERS.level(BASE_ENTITY)).toBe(LEVEL.subEntity);
    });

    it("returns root-entity when @ObjectModel.compositionRoot is true", () => {
        const entity = { ...BASE_ENTITY, "@ObjectModel.compositionRoot": true };
        expect(RESOLVERS.level(entity)).toBe(LEVEL.rootEntity);
    });

    it("returns root-entity when @ODM.root is true", () => {
        const entity = { ...BASE_ENTITY, "@ODM.root": true };
        expect(RESOLVERS.level(entity)).toBe(LEVEL.rootEntity);
    });

    it("prefers @ORD.Extensions.level over annotation-derived level", () => {
        const entity = { ...BASE_ENTITY, "@ORD.Extensions.level": "aggregate", "@ODM.root": true };
        expect(RESOLVERS.level(entity)).toBe("aggregate");
    });
});

describe("RESOLVERS.version", () => {
    let warnSpy;
    beforeEach(() => {
        warnSpy = jest.spyOn(Logger, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
        warnSpy.mockRestore();
    });

    it("derives version from ordId when no extension is set", () => {
        expect(RESOLVERS.version(BASE_ENTITY)).toBe("1.0.0");
    });

    it("uses @ORD.Extensions.version when set", () => {
        const entity = { ...BASE_ENTITY, "@ORD.Extensions.version": "2.3.4" };
        expect(RESOLVERS.version(entity)).toBe("2.3.4");
    });

    it("warns and still returns the value when version is not a valid semver", () => {
        const entity = { ...BASE_ENTITY, "@ORD.Extensions.version": "not-a-version" };
        expect(RESOLVERS.version(entity)).toBe("not-a-version");
        expect(warnSpy).toHaveBeenCalled();
    });

    it("does not warn for valid semver strings", () => {
        const entity = { ...BASE_ENTITY, "@ORD.Extensions.version": "1.0.0" };
        RESOLVERS.version(entity);
        expect(warnSpy).not.toHaveBeenCalled();
    });
});

describe("RESOLVERS.visibility", () => {
    it("defaults to public from appConfig env", () => {
        expect(RESOLVERS.visibility(BASE_ENTITY, BASE_APP_CONFIG)).toBe(RESOURCE_VISIBILITY.public);
    });

    it("defaults to public when appConfig.env is absent", () => {
        expect(RESOLVERS.visibility(BASE_ENTITY, {})).toBe(RESOURCE_VISIBILITY.public);
    });

    it("uses appConfig.env.defaultVisibility when no entity override", () => {
        const appConfig = { ...BASE_APP_CONFIG, env: { defaultVisibility: RESOURCE_VISIBILITY.internal } };
        expect(RESOLVERS.visibility(BASE_ENTITY, appConfig)).toBe(RESOURCE_VISIBILITY.internal);
    });

    it("prefers @ORD.Extensions.visibility over appConfig default", () => {
        const entity = { ...BASE_ENTITY, "@ORD.Extensions.visibility": RESOURCE_VISIBILITY.private };
        expect(RESOLVERS.visibility(entity, BASE_APP_CONFIG)).toBe(RESOURCE_VISIBILITY.private);
    });
});

describe("RESOLVERS.partOfPackage", () => {
    it("builds public package id without suffix", () => {
        expect(RESOLVERS.partOfPackage(BASE_ENTITY, BASE_APP_CONFIG)).toBe("sap.test:package:TestApp:v1");
    });

    it("appends visibility suffix for non-public visibility", () => {
        const entity = { ...BASE_ENTITY, "@ORD.Extensions.visibility": RESOURCE_VISIBILITY.internal };
        expect(RESOLVERS.partOfPackage(entity, BASE_APP_CONFIG)).toBe("sap.test:package:TestApp:v1");
    });

    it("strips non-alphanumeric characters from appName", () => {
        const appConfig = { ...BASE_APP_CONFIG, appName: "My App-Name!" };
        expect(RESOLVERS.partOfPackage(BASE_ENTITY, appConfig)).toBe("sap.test:package:MyAppName:v1");
    });

    it("prefers @ORD.Extensions.partOfPackage when set", () => {
        const entity = { ...BASE_ENTITY, "@ORD.Extensions.partOfPackage": "sap.test:package:custom:v1" };
        expect(RESOLVERS.partOfPackage(entity, BASE_APP_CONFIG)).toBe("sap.test:package:custom:v1");
    });
});

describe("createEntityTypeTemplate", () => {
    let warnSpy;
    const appConfig = {
        ordNamespace: "customer.testNamespace",
        appName: "testAppName",
        lastUpdate: "2022-12-19T15:47:04+00:00",
        policyLevels: ["none"],
        authConfig: {
            accessStrategies: [ORD_ACCESS_STRATEGY.Open],
        },
    };

    beforeEach(() => {
        warnSpy = jest.spyOn(Logger, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
        warnSpy.mockRestore();
    });

    it("produces a complete entity type object with defaults", () => {
        const result = createEntityTypeTemplate(BASE_APP_CONFIG, BASE_ENTITY);
        expect(result).toEqual({
            ordId: "sap.test:entityType:BusinessPartner:v1",
            title: "BusinessPartner",
            level: LEVEL.subEntity,
            localId: "BusinessPartner",
            version: "1.0.0",
            extensible: { supported: "no" },
            description: "Description for BusinessPartner",
            releaseStatus: "active",
            lastUpdate: "2024-01-01T00:00:00+00:00",
            visibility: RESOURCE_VISIBILITY.public,
            shortDescription: "Short description of BusinessPartner",
            partOfPackage: "sap.test:package:TestApp:v1",
        });
    });

    it("merges ORD extensions onto the result", () => {
        const entity = {
            ...BASE_ENTITY,
            "@ORD.Extensions.title": "My Entity",
            "@ORD.Extensions.releaseStatus": "beta",
        };
        const result = createEntityTypeTemplate(BASE_APP_CONFIG, entity);
        expect(result.title).toBe("My Entity");
        expect(result.releaseStatus).toBe("beta");
    });

    it("should return entity type with correct title from annotation '@EndUserText.label'", () => {
        const entityType = createEntityTypeTemplate(appConfig, {
            "@EndUserText.label": "Title of SomeAribaDummyEntity",
            "@EntityRelationship.entityType": "sap.sm:SomeAribaDummyEntity:v3",
        });

        expect(entityType).toBeDefined();
        expect(entityType.title).toEqual("Title of SomeAribaDummyEntity");
    });

    it("should return entity type with incorrect version, title and level:root-entity", () => {
        const entityWithVersion = {
            "@EntityRelationship.entityType": "sap.sm:SomeAribaDummyEntity:v3b",
            "@title": "Title of SomeAribaDummyEntity",
            "@ObjectModel.compositionRoot": true,
        };

        const entityType = createEntityTypeTemplate(appConfig, entityWithVersion);
        expect(entityType).toBeDefined();
        expect(entityType).toMatchSnapshot();
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(entityType.version).toEqual("3b.0.0");
        expect(entityType.level).toEqual("root-entity");
        expect(entityType.partOfPackage).toEqual("customer.testNamespace:package:testAppName:v1");
    });

    it("should return entity type with default version, title and level:sub-entity", () => {
        const entityWithoutVersion = {
            "@EntityRelationship.entityType": "sap.sm:SomeAribaDummyEntity:v1",
        };

        const entityType = createEntityTypeTemplate(appConfig, entityWithoutVersion);
        expect(entityType).toBeDefined();
        expect(entityType).toMatchSnapshot();
        expect(entityType.version).toEqual("1.0.0");
        expect(entityType.level).toEqual("sub-entity");
    });

    it("should keep EntityType visibility independent of private API references", () => {
        const entity = {
            "@EntityRelationship.entityType": "sap.sm:PrivateEntity:v1",
        };

        const updatedAppConfig = {
            ...appConfig,
            apiResources: [
                {
                    ordId: "sap.sm:apiResource:SomeAPI:v1",
                    visibility: "private",
                    exposedEntityTypes: [{ ordId: entity.ordId }],
                },
            ],
        };

        const entityType = createEntityTypeTemplate(updatedAppConfig, entity);

        expect(entityType).not.toBeNull();
        expect(entityType.visibility).toBe("public");
    });

    it("should assign the correct partOfPackage based on visibility", () => {
        const entity = {
            "@EntityRelationship.entityType": "sap.sm:PublicEntity:v1",
            "@ORD.Extensions.visibility": "public",
        };

        const updatedAppConfig = { ...appConfig };

        const entityType = createEntityTypeTemplate(updatedAppConfig, entity);

        expect(entityType).not.toBeNull();
        expect(entityType.partOfPackage).toBe("customer.testNamespace:package:testAppName:v1");
    });

    it("should assign the correct partOfPackage for a non-public entity (e.g., internal)", () => {
        const entity = {
            "@EntityRelationship.entityType": "sap.sm:InternalEntity:v1",
            "@ORD.Extensions.visibility": "internal",
        };

        const updatedAppConfig = { ...appConfig };

        const entityType = createEntityTypeTemplate(updatedAppConfig, entity);

        expect(entityType).not.toBeNull();
        expect(entityType.partOfPackage).toBe("customer.testNamespace:package:testAppName:v1");
    });
});
