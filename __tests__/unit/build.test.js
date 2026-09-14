const fs = require("fs");

const index = require("../../lib/index");
const { BUILD_DEFAULT_PATH, DOCUMENT_PERSPECTIVES } = require("../../lib/constants");

// Setup cds.build.Plugin mock BEFORE requiring build.js
const cds = require("@sap/cds");
cds.build = cds.build || {};
cds.build.Plugin = class {
    constructor() {
        this.task = {
            dest: undefined,
            src: null,
        };
    }
    write() {
        return {
            to: () => {
                return Promise.resolve();
            },
        };
    }
    async model() {
        return Promise.resolve({});
    }
};

// Now require the build plugin after the mock is set up
const OrdBuildPlugin = require("../../lib/build");

jest.mock("../../lib/index", () => {
    return {
        ord: jest.fn(() => {
            return {
                apiResources: [
                    {
                        ordId: "sap.sm:apiResource:SupplierService:v1",
                        resourceDefinitions: [
                            {
                                url: "https://example.com/resource1",
                            },
                            {
                                url: "https://example.com/resource2",
                            },
                        ],
                    },
                ],
                eventResources: [
                    {
                        ordId: "sap.sm:eventResource:SupplierService:v1",
                        resourceDefinitions: [
                            {
                                url: "https://example.com/event1",
                            },
                            {
                                url: "https://example.com/event2",
                            },
                        ],
                    },
                ],
            };
        }),
        getMetadata: jest.fn((url) => {
            return new Promise((resolve) => {
                resolve({
                    _: {},
                    response: `Metadata for ${url}`,
                });
            });
        }),
    };
});

jest.mock("cli-progress", () => {
    return {
        SingleBar: class {
            constructor() {}
            start() {}
            update() {}
            stop() {}
        },
    };
});

describe("Build", () => {
    beforeAll(() => {
        process.env.DEBUG = "true";
        cds.env.ord = { describedSystemVersion: { version: "0.0.1" } };
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();

        delete cds.env.protocols?.graphql;
        delete cds.env.ord.customOrdContentFile;
        delete cds.env.plugins?.["@cap-js/graphql"];
    });

    describe("GraphQL protocol restoration during cds build", () => {
        it("should restore graphql protocol when plugin is installed but protocol is missing", async () => {
            cds.env.plugins = { "@cap-js/graphql": { impl: "@cap-js/graphql/cds-plugin.js" } };
            cds.env.protocols = cds.env.protocols || {};
            delete cds.env.protocols.graphql;

            jest.spyOn(OrdBuildPlugin.prototype, "_generateResourcesFiles").mockImplementation(() => {});

            const buildClass = new OrdBuildPlugin();
            await buildClass.build();

            expect(cds.env.protocols.graphql).toEqual({ path: "/graphql", impl: "@cap-js/graphql" });
        });

        it("should not overwrite graphql protocol when already registered", async () => {
            cds.env.plugins = { "@cap-js/graphql": { impl: "@cap-js/graphql/cds-plugin.js" } };
            cds.env.protocols = cds.env.protocols || {};
            cds.env.protocols.graphql = { path: "/custom-graphql", impl: "@cap-js/graphql" };

            jest.spyOn(OrdBuildPlugin.prototype, "_generateResourcesFiles").mockImplementation(() => {});

            const buildClass = new OrdBuildPlugin();
            await buildClass.build();

            expect(cds.env.protocols.graphql.path).toBe("/custom-graphql");
        });

        it("should not restore graphql protocol when plugin is not installed", async () => {
            cds.env.plugins = {};
            cds.env.protocols = cds.env.protocols || {};
            delete cds.env.protocols.graphql;

            jest.spyOn(OrdBuildPlugin.prototype, "_generateResourcesFiles").mockImplementation(() => {});

            const buildClass = new OrdBuildPlugin();
            await buildClass.build();

            expect(cds.env.protocols.graphql).toBeUndefined();
        });
    });

    it("should create an instance of OrdBuildPlugin", () => {
        const buildClass = new OrdBuildPlugin();
        expect(buildClass).toBeInstanceOf(OrdBuildPlugin);
    });

    it("should set the task destination to gen/ord", () => {
        const buildClass = new OrdBuildPlugin();
        const customDest = "test";
        buildClass.task.dest = customDest;
        buildClass.init();
        expect(buildClass.task.dest).toBe(customDest);
    });

    it("should set the task destination with custom dest", () => {
        const buildClass = new OrdBuildPlugin();
        buildClass.init();
        expect(buildClass.task.dest).toBe(cds.utils.path.join(cds.root, BUILD_DEFAULT_PATH));
    });

    it("should write the ord document and resources files", async () => {
        const invocations = [];
        const buildClass = new OrdBuildPlugin();

        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(OrdBuildPlugin.prototype, "_generateResourcesFiles").mockImplementation(async (model) => {
            const document = index.ord(model);

            await Promise.all(
                [...(document.apiResources ?? []), ...(document.eventResources ?? [])].flatMap(
                    ({ ordId, resourceDefinitions }) =>
                        resourceDefinitions
                            .map(({ url }) => [
                                url.split("/").pop(),
                                cds.utils.path.join(cds.root, BUILD_DEFAULT_PATH, ordId),
                            ])
                            .map(async ([file, path]) =>
                                Promise.resolve(invocations.push(`Writing ${file} to ${path}`)),
                            ),
                ),
            );
        });

        expect((await buildClass.build()).length).toEqual(2);
        expect(buildClass._generateResourcesFiles).toHaveBeenCalledTimes(1);
        expect(invocations.length).toEqual(4);
    });

    it("should not generate resource files for API resources from a custom ORD extension", async () => {
        cds.env.ord.customOrdContentFile = "__tests__/unit/utils/custom-api-resource.ord.json";
        index.ord.mockImplementation((model, extensions = []) => {
            if (!extensions.length) return { apiResources: [] };

            return { apiResources: extensions.flatMap(({ apiResources }) => apiResources ?? []) };
        });

        const buildClass = new OrdBuildPlugin();
        const createWorkerPool = jest.spyOn(buildClass, "_createWorkerPool");

        await expect(buildClass.build()).resolves.toHaveLength(2);
        expect(index.ord).toHaveBeenNthCalledWith(1, {});
        expect(index.ord).toHaveBeenNthCalledWith(2, {}, [
            expect.objectContaining(JSON.parse(fs.readFileSync(cds.env.ord.customOrdContentFile, "utf-8"))),
        ]);
        expect(createWorkerPool).not.toHaveBeenCalled();
    });

    it("should not generate resource files for event resources from a custom ORD extension", async () => {
        cds.env.ord.customOrdContentFile = "__tests__/unit/utils/custom-event-resource.ord.json";
        index.ord.mockImplementation((model, extensions = []) => {
            if (!extensions.length) return { eventResources: [] };

            return { eventResources: extensions.flatMap(({ eventResources }) => eventResources ?? []) };
        });

        const buildClass = new OrdBuildPlugin();
        const createWorkerPool = jest.spyOn(buildClass, "_createWorkerPool");

        await expect(buildClass.build()).resolves.toHaveLength(2);
        expect(index.ord).toHaveBeenNthCalledWith(1, {});
        expect(index.ord).toHaveBeenNthCalledWith(2, {}, [
            expect.objectContaining(JSON.parse(fs.readFileSync(cds.env.ord.customOrdContentFile, "utf-8"))),
        ]);
        expect(createWorkerPool).not.toHaveBeenCalled();
    });

    it("should not write resources files when eventResources is empty", async () => {
        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(index, "ord").mockReturnValue({
            apiResources: [
                {
                    ordId: "sap.sm:apiResource:SupplierService:v1",
                    resourceDefinitions: [{ url: "https://example.com/resource1" }],
                },
            ],
        });
        jest.spyOn(OrdBuildPlugin.prototype, "_generateResourcesFiles").mockImplementation(async (model) => {
            const document = index.ord(model);

            await Promise.all(
                [...(document.apiResources ?? []), ...(document.eventResources ?? [])].flatMap(
                    ({ ordId, resourceDefinitions }) =>
                        resourceDefinitions.map(({ url }) =>
                            Promise.resolve(
                                `Writing ${url.split("/").pop()} to ${cds.utils.path.join(cds.root, BUILD_DEFAULT_PATH, ordId)}`,
                            ),
                        ),
                ),
            );
        });

        const buildClass = new OrdBuildPlugin();
        await buildClass.build();

        expect(buildClass._generateResourcesFiles).toHaveBeenCalledTimes(1);
    });

    it("should throw error when metadata compilation fails", async () => {
        const buildClass = new OrdBuildPlugin();
        jest.spyOn(OrdBuildPlugin.prototype, "_createWorkerPool").mockImplementation(() => {
            return new (class {
                close() {}
                run() {
                    return Promise.reject(new Error());
                }
            })();
        });

        const resources = [
            {
                ordId: "sap.sm:apiResource:SupplierService:v1",
                resourceDefinitions: [
                    {
                        url: "https://example.com/resource1",
                    },
                ],
            },
        ];

        await expect(buildClass._generateResourcesFiles({}, resources)).rejects.toThrow();
    });

    it("should update resource URLs with relative paths and without colunms", () => {
        const buildClass = new OrdBuildPlugin();
        const ordDocument = {
            apiResources: [
                {
                    ordId: "customer.sample:apiResource:ProcessorService:v1",
                    resourceDefinitions: [
                        { url: "/ord/v1/customer.sample:apiResource:ProcessorService:v1/ProcessorService.oas3.json" },
                        { url: "/ord/v1/customer.sample:apiResource:ProcessorService:v2/ProcessorService.oas3.json" },
                    ],
                },
            ],
            eventResources: [
                {
                    ordId: "customer.sample:eventResource:ProcessorService:v1",
                    resourceDefinitions: [
                        {
                            url: "/ord/v1/customer.sample:eventResource:ProcessorService:v1/ProcessorService.asyncapi2.json",
                        },
                        {
                            url: "/ord/v1/customer.sample:eventResource:ProcessorService:v2/ProcessorService.asyncapi2.json",
                        },
                    ],
                },
            ],
        };

        const updatedOrdDocument = buildClass._postProcess(ordDocument);

        expect(updatedOrdDocument.perspective).toBe(DOCUMENT_PERSPECTIVES.SystemVersion);
        expect(updatedOrdDocument.describedSystemVersion).toEqual({ version: "0.0.1" });
        expect(updatedOrdDocument.apiResources[0].resourceDefinitions[0].url).toBe(
            "customer.sample_apiResource_ProcessorService_v1/ProcessorService.oas3.json",
        );
        expect(updatedOrdDocument.eventResources[0].resourceDefinitions[0].url).toBe(
            "customer.sample_eventResource_ProcessorService_v1/ProcessorService.asyncapi2.json",
        );
    });
});
