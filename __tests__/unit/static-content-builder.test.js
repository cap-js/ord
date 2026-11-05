const path = require("path");
const cds = require("@sap/cds");
const { DOCUMENT_PERSPECTIVES } = require("../../lib/constants");

// Supply the build API before loading the builders, as in build.test.js.
cds.build = cds.build || {};
cds.build.Plugin = class {};
cds.build.BuildError = class BuildError extends Error {};
const OrdBuilder = require("../../lib/build/ord-builder");
const StaticContentBuilder = require("../../lib/build/static-content-builder");
const { ord } = require("../../lib/index");
const { getCustomORDContent } = require("../../lib/extend-ord-with-custom");

jest.mock("../../lib/index", () => ({ ord: jest.fn() }));
jest.mock("../../lib/extend-ord-with-custom", () => ({ getCustomORDContent: jest.fn() }));

describe("Static content builder", () => {
    let builder;
    let plugin;
    let writes;
    let document;
    let previousOrd;
    let previousCli;
    const model = { definitions: {} };
    const namespace = "customer.sample";
    const header = { openResourceDiscovery: "1.17", policyLevels: ["none"] };

    const resource = (kind, name) => ({
        ordId: `${namespace}:${kind}:${name}:v1`,
        title: name,
        resourceDefinitions: [
            { url: `/ord/v1/${namespace}:${kind}:${name}:v1/${name}.json`, type: "openapi-v3" },
            { url: `https://example.com/${name}.xml`, type: "odata-v4" },
        ],
    });

    beforeEach(() => {
        previousOrd = cds.env.ord;
        previousCli = cds.cli;
        cds.env.ord = { namespace, describedSystemVersion: { version: "2.0.0" } };
        document = {
            ...header,
            description: "Sample application",
            products: [{ ordId: `${namespace}:product:Sample:v1` }],
            packages: [{ ordId: `${namespace}:package:Sample:v1` }],
            apiResources: [resource("apiResource", "Books"), resource("apiResource", "Authors")],
            eventResources: [resource("eventResource", "BookCreated")],
        };
        ord.mockReset().mockImplementation(() => structuredClone(document));
        getCustomORDContent.mockReset().mockReturnValue({});
        writes = new Map();
        plugin = new OrdBuilder();
        plugin.model = jest.fn().mockResolvedValue(model);
        plugin.write = jest.fn((content) => ({
            to: jest.fn(async (destination) => writes.set(destination, content)),
        }));
        jest.spyOn(plugin, "_generateResourcesFiles").mockResolvedValue([]);
        builder = new StaticContentBuilder(plugin);
    });

    afterEach(() => {
        cds.env.ord = previousOrd;
        cds.cli = previousCli;
        jest.restoreAllMocks();
    });

    it("writes main and package documents with their respective content", async () => {
        await builder.build();

        expect(writes.get("main.ord.json")).toEqual({
            ...header,
            description: document.description,
            products: document.products,
            perspective: DOCUMENT_PERSPECTIVES.SystemVersion,
            describedSystemVersion: { version: "2.0.0" },
        });
        expect(writes.get(path.join(namespace, "package.ord.json"))).toEqual({
            ...header,
            packages: document.packages,
        });
        expect(writes.size).toBe(5);
        expect(plugin._generateResourcesFiles).toHaveBeenCalledWith(model, document, namespace);
    });

    it.each(["apiResources", "eventResources"])(
        "writes each %s document beside its definitions with relative URLs",
        async (collection) => {
            const original = structuredClone(document);
            await builder.build();

            for (const entry of document[collection]) {
                const destination = path.join(namespace, entry.ordId.replace(/:/g, "_"), "ord.json");
                expect(writes.get(destination)).toEqual({
                    ...header,
                    [collection]: [
                        {
                            ...entry,
                            resourceDefinitions: [
                                { url: `./${entry.title}.json`, type: "openapi-v3" },
                                { url: `./${entry.title}.xml`, type: "odata-v4" },
                            ],
                        },
                    ],
                });
            }
            expect(document).toEqual(original);
        },
    );

    it("adjusts resource URLs without mutating the resource or its definitions", () => {
        const entry = document.apiResources[0];
        const original = structuredClone(entry);
        const adjusted = builder._adjustResource(entry);

        expect(adjusted.resourceDefinitions.map(({ url }) => url)).toEqual(["./Books.json", "./Books.xml"]);
        expect(entry).toEqual(original);
        expect(adjusted).not.toBe(entry);
        expect(adjusted.resourceDefinitions[0]).not.toBe(entry.resourceDefinitions[0]);
    });

    it.each([undefined, []])("skips missing or empty collections (%s)", async (entries) => {
        document.packages = entries;
        document.apiResources = entries;
        document.eventResources = entries;

        await expect(builder.build()).resolves.toHaveLength(5);
        expect([...writes.keys()]).toEqual(["main.ord.json"]);
    });

    it.each(["apiResources", "eventResources"])(
        "includes custom %s but only compiles generated resource definitions",
        async (collection) => {
            cds.env.ord.customOrdContentFile = "custom.ord.json";
            const customResource = resource(collection === "apiResources" ? "apiResource" : "eventResource", "Custom");
            const extension = { [collection]: [customResource] };
            getCustomORDContent.mockReturnValue(extension);
            ord.mockImplementation((csn, extensions = []) => ({
                ...structuredClone(document),
                [collection]: [...document[collection], ...extensions.flatMap((item) => item[collection] ?? [])],
            }));

            await builder.build();

            expect(getCustomORDContent).toHaveBeenCalledWith("custom.ord.json");
            expect(ord).toHaveBeenCalledWith(model, [extension]);
            expect(
                writes.get(path.join(namespace, customResource.ordId.replace(/:/g, "_"), "ord.json"))[collection][0]
                    .title,
            ).toBe("Custom");
            expect(plugin._generateResourcesFiles).toHaveBeenCalledWith(model, document, namespace);
        },
    );

    it.each(["model", "write", "compile"])("reports %s failures as ORD build errors", async (stage) => {
        const error = new Error(`${stage} failed`);
        if (stage === "model") plugin.model.mockRejectedValue(error);
        if (stage === "write") plugin.write.mockReturnValue({ to: () => Promise.reject(error) });
        if (stage === "compile") plugin._generateResourcesFiles.mockRejectedValue(error);

        await expect(builder.build()).rejects.toThrow(new cds.build.BuildError(`ORD build failed: ${error.message}`));
    });

    it("selects the static content strategy through the ORD build plugin", async () => {
        cds.cli = { options: { taskOptions: { strategy: "static-content" } } };
        const prototype = Object.getPrototypeOf(plugin);
        const task = { dest: "custom-output" };
        plugin.task = task;

        await plugin.build();

        expect(Object.getPrototypeOf(plugin)).toBe(prototype);
        expect(plugin.task).toBe(task);
        expect(plugin).toBeInstanceOf(OrdBuilder);
        expect(writes.has("main.ord.json")).toBe(true);
        expect(writes.has(path.join(namespace, "package.ord.json"))).toBe(true);
    });

    it("selects the strategy again when the same plugin builds a second time", async () => {
        cds.cli = { options: { taskOptions: { strategy: "static-content" } } };
        await plugin.build();
        expect(writes.has("main.ord.json")).toBe(true);

        writes.clear();
        cds.cli.options.taskOptions.strategy = "standard";
        await plugin.build();

        expect([...writes.keys()]).toEqual(["ord-document.json"]);
        expect(plugin._generateResourcesFiles).toHaveBeenLastCalledWith(model, document, ".");
    });

    it("rejects an unsupported strategy before loading the model or writing files", async () => {
        cds.cli = { options: { taskOptions: { strategy: "unsupported" } } };

        await expect(plugin.build()).rejects.toThrow("Invalid strategy: unsupported");
        expect(plugin.model).not.toHaveBeenCalled();
        expect(plugin.write).not.toHaveBeenCalled();
    });
});
