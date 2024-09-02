const cds = require("@sap/cds");
const ord = require("../lib/ord");
const path = require("path");

describe("Tests for default ORD document", () => {
  let csn;

  beforeAll(async () => {
    csn = await cds.load(path.join(__dirname, "bookshop", "srv"));
  });

  test("Successfully create ORD Documents with defaults", () => {
    const document = ord(csn);
    expect(document).toMatchSnapshot();
  });


  describe("eventResources", () => {
    const eventResourceId = /^([a-z0-9-]+(?:[.][a-z0-9-]+)*):([a-zA-Z0-9._\-/]+):([a-z0-9-]+(?:[.][a-z0-9-]+)*):(?<service>[a-zA-Z0-9._\-/]+)$/

    let document;

    beforeAll(()=> {
      document = ord(csn);
    })

    test("Assigned to excactly one CDS Service group", () => {
      for (const eventResource of document.eventResources) {
        expect(eventResource.partOfGroups.length).toEqual(1)
      }
    });
  
    test("The CDS Service Group ID includes the CDS Service identifier", () => {
      for (const eventResource of document.eventResources) {
        const [groupId] = eventResource.partOfGroups
        expect(groupId).toMatch(eventResourceId)

        const match = eventResourceId.exec(groupId)
        if (match && match.groups?.service) {
          let service = match.groups?.service
          if (service.startsWith("undefined")) service = service.replace("undefined.", "")
          const definition = csn.definitions[service]
          expect(definition).toBeDefined()
          expect(definition.kind).toEqual("service")
        }
      }
    })
  })
});
