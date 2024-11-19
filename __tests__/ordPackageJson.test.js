const cds = require("@sap/cds");
const ord = require("../lib/ord");
const path = require("path");

jest.mock("../lib/date", () => ({
    getRFC3339Date: jest.fn(() => "2024-11-04T14:33:25+01:00")
}));

describe("Tests for default ORD document when .cdsrc.json is not present", () => {
    let csn;

    beforeAll(async () => {
        csn = await cds.load(path.join(__dirname, "bookshop", "srv"));
    });

    beforeEach(() => {
        cds.root = path.join(__dirname, "bookshop");
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
                expect(
                    document.packages.find(
                        (pck) => pck.ordId === apiResource.partOfPackage
                    )
                ).toBeDefined();
            }
        });
    });

    describe("eventResources", () => {
        // eslint-disable-next-line no-useless-escape
        const GROUP_ID_REGEX = /^([a-z0-9-]+(?:[.][a-z0-9-]+)*):([a-zA-Z0-9._\-/]+):([a-z0-9-]+(?:[.][a-z0-9-]+)*):(?<service>[a-zA-Z0-9._\-/]+)$/;

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
                    if (service.startsWith("undefined"))
                        service = service.replace("undefined.", "");
                    const definition = csn.definitions[service];
                    expect(definition).toBeDefined();
                    expect(definition.kind).toEqual("service");
                }
            }
        });
    });

    describe("integrationDependency", () => {
        let document;

        beforeAll(() => {
            document = ord(csn);
        });

        test("ordId values are valid ORD IDs", () => {
            const ORD_ID_REGEX = /^([a-z0-9]+(?:[.][a-z0-9]+)*):integrationDependency:([a-zA-Z0-9.-]+):(v0|v[1-9][0-9]*)$/;
            for (const dep of document.integrationDependency) {
                expect(dep.ordId).toMatch(ORD_ID_REGEX);
            }
        });

        test("partOfPackage values are valid package IDs", () => {
            const PACKAGE_ID_REGEX = /^([a-z0-9]+(?:[.][a-z0-9]+)*):(package):([a-zA-Z0-9._-]+):(v0|v[1-9][0-9]*)$/;
            for (const dep of document.integrationDependency) {
                expect(dep.partOfPackage).toBeDefined();
                expect(dep.partOfPackage).toMatch(PACKAGE_ID_REGEX);
            }
        });
        
        test("aspects contain valid eventResources", () => {
            for (const dep of document.integrationDependency) {
                expect(dep.aspects).toBeDefined();
                for (const aspect of dep.aspects) {
                    expect(aspect.eventResources).toBeDefined();
                    expect(Array.isArray(aspect.eventResources)).toBe(true);
                }
            }
        });
        
        test("eventResources ordId values are valid", () => {
            const EVENT_RESOURCE_ORD_ID_REGEX = /^([a-z0-9]+(?:[.][a-z0-9]+)*):eventResource:([a-zA-Z0-9._-]+):(v0|v[1-9][0-9]*)$/;
            for (const dep of document.integrationDependency) {
                for (const aspect of dep.aspects) {
                    for (const eventResource of aspect.eventResources) {
                        expect(eventResource.ordId).toMatch(EVENT_RESOURCE_ORD_ID_REGEX);
                    }
                }
            }
        });

        test("eventResources subset contains valid eventType fields", () => {
            for (const dep of document.integrationDependency) {
                for (const aspect of dep.aspects) {
                    for (const eventResource of aspect.eventResources) {
                        expect(eventResource.subset).toBeDefined();
                        expect(Array.isArray(eventResource.subset)).toBe(true);
                        for (const subsetItem of eventResource.subset) {
                            expect(subsetItem.eventType).toBeDefined();
                            expect(typeof subsetItem.eventType).toBe("string");
                        }
                    }
                }
            }
        });
        
        test("partOfPackage matches an existing package ordId", () => {
            const packageOrdIds = document.packages.map(pkg => pkg.ordId);
            for (const dep of document.integrationDependency) {
                expect(packageOrdIds).toContain(dep.partOfPackage);
            }
        });
    });
    
});
