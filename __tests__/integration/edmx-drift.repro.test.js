const path = require("path");
const cds = require("@sap/cds");
const { OpenResourceDiscoveryService } = require("../../lib/services/ord-service");

// NOTE on harness: the shared __tests__/hooks/test-app.js + cds.test() use mocha-style
// global before()/after(); on Node 26 those leak to the built-in node:test runner and
// collide with jest (0 tests / server torn down early). So we boot the real cds server
// programmatically inside jest's own lifecycle and drive it over real HTTP via fetch().
const APP_DIR = path.join(__dirname, "integration-test-app");
let baseUrl;

beforeAll(async () => {
    cds.root = APP_DIR;
    const { url } = await cds.exec("--in-memory?", "--port", "0");
    baseUrl = url;
}, 60000);

afterAll(async () => {
    try {
        await cds.shutdown();
    } catch {
        /* ignore */
    }
});

async function getJson(pathname) {
    const res = await fetch(baseUrl + pathname);
    return { status: res.status, data: await res.json() };
}
async function getText(pathname) {
    const res = await fetch(baseUrl + pathname);
    return { status: res.status, data: await res.text() };
}
function edmxLinksOf(doc) {
    return (doc.apiResources || [])
        .flatMap((ar) => ar.resourceDefinitions || [])
        .map((rd) => rd.url)
        .filter((url) => /\.edmx$/.test(url));
}

// Reproduces cap-js/ord#543 (recurrence of #330): an ODATA API's EDMX link is listed in
// the ORD document but returns HTTP 500 when API Hub fetches it, because the document and
// the .edmx are two independent requests that each re-resolve the CDS model. Under MTX /
// feature-toggles the .edmx request goes through the dynamic getCsn() path, which on BTP
// (multi-instance load balancing + getCsn cache/recompile window) can return a model that
// no longer contains the service -> cds.compile(...).to.edmx throws -> 500.
describe("REPRO cap-js/ord#543 - documented edmx link 500s under model drift", () => {
    let edmxUrl;

    test("happy path: every edmx link listed in the document is fetchable (200)", async () => {
        const doc = await getJson("/ord/v1/documents/ord-document");
        expect(doc.status).toBe(200);

        const links = edmxLinksOf(doc.data);
        expect(links.length).toBeGreaterThan(0);
        edmxUrl = links[0];

        for (const link of links) {
            const res = await getText(link);
            expect(res.status).toBe(200);
        }
    });

    test("drift: the SAME edmx link now returns 500 because the request-time model lacks the service", async () => {
        expect(edmxUrl).toBeTruthy();

        // Force the dynamic model-resolution path and make it diverge, exactly as BTP
        // multi-instance / getCsn-cache drift does: default toggles != "*" routes
        // resolveCdsModel() through getCsn(), which returns a composition missing the service.
        const originalToggles = OpenResourceDiscoveryService.resolveDefaultFeatureToggles;
        const originalConnectTo = cds.connect.to;
        OpenResourceDiscoveryService.resolveDefaultFeatureToggles = async () => ["someFeature"];
        const driftedModel = cds.linked(cds.parse.cdl(`service Unrelated { entity E { key ID: Integer; } }`));
        cds.connect.to = async (name, ...rest) =>
            name === "cds.xt.ModelProviderService"
                ? { getCsn: async () => driftedModel }
                : originalConnectTo.call(cds.connect, name, ...rest);

        try {
            const res = await getText(edmxUrl);
            expect(res.status).toBe(500);
            expect(res.data).toMatch(/No service definition matching/i);
        } finally {
            OpenResourceDiscoveryService.resolveDefaultFeatureToggles = originalToggles;
            cds.connect.to = originalConnectTo;
        }
    });
});
