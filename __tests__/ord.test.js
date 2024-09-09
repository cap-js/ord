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
});
