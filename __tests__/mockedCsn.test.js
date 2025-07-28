const cds = require("@sap/cds");
const path = require("path");
const { AUTHENTICATION_TYPE } = require("../lib/constants");

describe("Tests for ORD document generated out of mocked csn files", () => {
    let ord;

    beforeAll(() => {
        cds.root = path.join(__dirname, "bookshop");
        jest.spyOn(cds, "context", "get").mockReturnValue({
            authConfig: {
                types: [AUTHENTICATION_TYPE.Open],
            },
        });
        jest.spyOn(require("../lib/date"), "getRFC3339Date").mockReturnValue("2024-11-04T14:33:25+01:00");
        ord = require("../lib/ord");
    });

    beforeEach(() => {
        cds.env.ord = {
            namespace: "sap.test.cdsrc.sample",
            openResourceDiscovery: "1.10",
            description: "this is my custom description",
            policyLevels: ["sap:core:v1"],
        };
    });

    afterAll(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    describe("Tests for ORD document when .cdsrc.json has no `ord` property", () => {
        test("Successfully create ORD Documents with no `ord` in .cdsrc.json", () => {
            cds.env = {};
            const csn = require("./__mocks__/publicResourcesCsn.json");
            const document = ord(csn);
            expect(document).not.toBeUndefined();
            expect(document).toMatchSnapshot();
        });
    });

    describe("Tests for ORD document when there no events or entities in service definitions", () => {
        test("Successfully create ORD Document: no entityTypeMappings field in apiResource", () => {
            cds.env = {};
            const csn = require("./__mocks__/noEntitiesInServiceDefinitionCsn.json");
            const document = ord(csn);

            expect(document).not.toBeUndefined();
            expect(document.apiResources).toHaveLength(1);
            expect(document.eventResources).toHaveLength(1);
            expect(document.eventResources[0].ordId).toEqual(expect.stringContaining("EbMtEmitter"));
            expect(document).toMatchSnapshot();
        });
    });

    describe("Tests for ORD document checking if entityTypes and entityTypeMappings are generated correctly", () => {
        test("Successfully create ORD Document: entityTypes with local entities and entityTypeMappings containing referenced entities", () => {
            cds.env.ord.policyLevels = ["none"];
            const csn = require("./__mocks__/localAndNonODMReferencedEntitiesCsn.json");
            const document = ord(csn);

            expect(document).not.toBeUndefined();
            expect(document.entityTypes).toHaveLength(1);
            expect(document.entityTypes[0].partOfPackage).toEqual(
                "sap.test.cdsrc.sample:package:capirebookshopordsample:v1", //for customer, no package by type
            );
            expect(document.entityTypes[0].ordId).toEqual("sap.sm:entityType:SomeAribaDummyEntity:v1");
            expect(document.entityTypes[0].level).toEqual(expect.stringContaining("root-entity"));
            expect(document.apiResources[0].exposedEntityTypes).toEqual(
                expect.arrayContaining([
                    { ordId: "sap.odm:entityType:SomeODMEntity:v1" },
                    { ordId: "sap.sm:entityType:SomeAribaDummyEntity:v1" },
                ]),
            );
        });
    });

    describe("Tests for ORD document when all the resources are private", () => {
        test("All services are private: Successfully create ORD Documents without packages, empty apiResources and eventResources lists", () => {
            const csn = require("./__mocks__/privateResourcesCsn.json");
            const document = ord(csn);

            expect(document).not.toBeUndefined();
            expect(document.packages).toHaveLength(0);
            expect(document.apiResources).toBeUndefined();
            expect(document.eventResources).toBeUndefined();
        });
    });

    describe("Tests for ORD document when all the resources are internal", () => {
        test("All services are internal: Successfully create ORD Documents with packages, apiResources and eventResources lists", () => {
            const csn = require("./__mocks__/internalResourcesCsn.json");
            const document = ord(csn);

            expect(document).not.toBeUndefined();
            expect(document.packages).toBeDefined();
            expect(document.apiResources).toBeDefined();
            expect(document.eventResources).toBeDefined();
        });
    });

    describe("Tests for ORD document when there no events or entities in service definitions", () => {
        test("Successfully create ORD Documents: no Catalog service in apiResource; no Admin service in eventResources", () => {
            const csn = require("./__mocks__/noApisCsn.json");
            const document = ord(csn);

            expect(document).not.toBeUndefined();
            expect(document.apiResources).toBeUndefined();
            expect(document.eventResources).toBeUndefined();
        });

        test("Successfully create ORD Documents: no eventResources", () => {
            const csn = require("./__mocks__/csnWithoutEvents.json");
            const document = ord(csn);

            expect(document).not.toBeUndefined();
            expect(document.apiResources).toHaveLength(1);
            expect(document.eventResources).toBeUndefined();
            expect(document.apiResources[0].ordId).toEqual(expect.stringContaining("LocalService"));
        });

        test("Should generate eventResource if the service contains", () => {
            const csn = require("./__mocks__/csnWithOneEvent.json");
            const document = ord(csn);

            expect(document).not.toBeUndefined();
            expect(document.apiResources).toHaveLength(2);
            expect(document.eventResources).toHaveLength(1);
            expect(document.apiResources[0].ordId).toEqual(expect.stringContaining("LocalService"));
        });
    });

    describe("Tests for ORD document when service is annotated as a primary Data Product`", () => {
        test("Successfully create ORD Documents: ", () => {
            const csn = require("./__mocks__/dataProductCsn.json");
            const document = ord(csn);

            expect(document).not.toBeUndefined();
            expect(document.apiResources).toHaveLength(1);
            const dataProductApiResources = document.apiResources.filter(
                (resource) => resource.implementationStandard === "sap.dp:data-subscription-api:v1",
            );
            expect(dataProductApiResources).toHaveLength(1);
            expect(dataProductApiResources[0].resourceDefinitions).toHaveLength(1);
            expect(dataProductApiResources[0].resourceDefinitions[0].type).toEqual("sap-csn-interop-effective-v1");
            expect(dataProductApiResources[0].partOfPackage).toEqual(
                "sap.test.cdsrc.sample:package:capirebookshopordsample-api-internal:v1",
            );
        });

        test("Should not generate duplicate apiResources when the servie is annotated as primary data product ", () => {
            const csn = require("./__mocks__/dataProductCsn.json");
            const document = ord(csn);
            expect(document.apiResources).toHaveLength(1);
        });
    });
});
