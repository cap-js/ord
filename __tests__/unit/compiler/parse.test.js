const cds = require("@sap/cds");
const path = require("path");

jest.mock("../../../lib/date", () => ({
    getRFC3339Date: () => "2024-11-04T14:33:25+01:00",
}));

describe("parse", () => {
    const { parse } = require("../../../lib/compiler/parse");

    beforeAll(() => {
        cds.root = path.join(__dirname, "../../bookshop");
    });

    test("returns document with config, services, entities, externalServices, customOrd, extensions", async () => {
        const csn = await cds.load(path.join(cds.root, "srv"));
        const result = parse(csn);

        expect(result.config).toBeDefined();
        expect(result.services).toBeDefined();
        expect(result.entities).toBeDefined();
        expect(result.externalServices).toBeDefined();
        expect(result.customOrd).toBeDefined();
        expect(result.extensions).toEqual([]);
    });

    test("config contains ordNamespace derived from package.json", async () => {
        const csn = await cds.load(path.join(cds.root, "srv"));
        const result = parse(csn);

        expect(result.config.ordNamespace).toBeDefined();
        expect(result.config.packageName).toBeDefined();
        expect(result.config.appName).toBeDefined();
        expect(result.config.lastUpdate).toBe("2024-11-04T14:33:25+01:00");
    });

    test("services have name, definition, protocols, extensions, hasEvents", async () => {
        const csn = await cds.load(path.join(cds.root, "srv"));
        const result = parse(csn);

        expect(result.services.length).toBeGreaterThan(0);
        for (const service of result.services) {
            expect(service.name).toBeDefined();
            expect(service.definition).toBeDefined();
            expect(service.protocols).toBeDefined();
            expect(service.extensions).toBeDefined();
            expect(typeof service.hasEvents).toBe("boolean");
        }
    });

    test("filters out blocked service names", () => {
        const linkedCsn = cds.linked(`
            service OpenResourceDiscoveryService { entity Items { key ID: UUID; } };
            service ValidService { entity Products { key ID: UUID; } };
        `);
        const result = parse(linkedCsn);
        const serviceNames = result.services.map((s) => s.name);

        expect(serviceNames).not.toContain("OpenResourceDiscoveryService");
    });

    test("detects event-only services", () => {
        const linkedCsn = cds.linked(`
            service EventOnlyService {
                event OrderCreated { orderId: UUID; }
            };
        `);
        const result = parse(linkedCsn);
        const eventService = result.services.find((s) => s.name === "EventOnlyService");

        expect(eventService).toBeDefined();
        expect(eventService.hasEvents).toBe(true);
        expect(eventService.protocols).toHaveLength(0);
    });

    test("reads ORD extensions from service annotations", () => {
        const linkedCsn = cds.linked(`
            @ORD.Extensions.title: 'Custom Title'
            @ORD.Extensions.visibility: 'internal'
            service AnnotatedService {
                entity Items { key ID: UUID; }
            };
        `);
        const result = parse(linkedCsn);
        const svc = result.services.find((s) => s.name === "AnnotatedService");

        expect(svc.extensions.title).toBe("Custom Title");
        expect(svc.extensions.visibility).toBe("internal");
    });

    test("passes extensions array through unchanged", async () => {
        const csn = await cds.load(path.join(cds.root, "srv"));
        const customExtensions = [{ packages: [{ ordId: "custom:package:v1" }] }];
        const result = parse(csn, customExtensions);

        expect(result.extensions).toEqual(customExtensions);
    });
});
