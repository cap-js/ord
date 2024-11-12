const ord = require("../lib/ord");
const private_csn = require("./__mocks__/privateResourcesCsn.json");
const internal_csn = require("./__mocks__/internalResourcesCsn.json");


// Mock the @sap/cds module
jest.mock("@sap/cds", () => {
    const path = require("path");
    let cds = jest.requireActual("@sap/cds");
    cds.root = path.join(__dirname, "bookshop");

    return cds;
});

jest.mock("../lib/extendOrdWithCustom", () => ({
    extendCustomORDContentIfExists: jest.fn(
        (_appConfig, ordContent, _lazyLogger) => {
            console.log(
                "The custom.ord.json file is not considered for the purpose of this test."
            );
            return ordContent;
        }
    ),
}));

describe("Tests for ORD document when there is no public service", () => {
    afterAll(() => {
        jest.clearAllMocks();
    })

    test("All services are private: Successfully create ORD Documents without packages, empty apiResources and eventResources lists", () => {
        const document = ord(private_csn);

        expect(document.packages).not.toBeDefined();
        expect(document.apiResources).toHaveLength(0);
        expect(document.eventResources).toHaveLength(0);
    });

    test("All services are internal: Successfully create ORD Documents without packages, empty apiResources and eventResources lists", () => {
        const document = ord(internal_csn);

        expect(document.packages).not.toBeDefined();
        expect(document.apiResources).toHaveLength(0);
        expect(document.eventResources).toHaveLength(0);
    });
});
