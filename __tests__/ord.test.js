const ord = require("../lib/ord");
const { join } = require("path");

// Mock the @sap/cds module
jest.mock("@sap/cds", () => {
    const { join } = require("path");
    let originalCds = jest.requireActual("@sap/cds");
    originalCds.root = join(__dirname, "bookshop");
    return originalCds;
});

const cds = require("@sap/cds");

describe("Tests for default ORD document", () => {
    let csn;

    beforeAll(async () => {
        csn = await cds.load(join(__dirname, "bookshop", "srv"));
    });

    test("Successfully create ORD Documents with defaults", () => {
        const document = ord(csn);
        expect(document).toMatchSnapshot();
    });

    describe("apiResources", () => {
        const PACKAGE_ID_REGEX = /^([a-z0-9]+(?:[.][a-z0-9]+)*):(package):([a-zA-Z0-9._-]+):(v0|v[1-9][0-9]*)$/;
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
                    if (service.startsWith("undefined"))
                        service = service.replace("undefined.", "");
                    const definition = csn.definitions[service];
                    expect(definition).toBeDefined();
                    expect(definition.kind).toEqual("service");
                }
            }
        });
    });
});
