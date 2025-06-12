const cds = require("@sap/cds");
const path = require("path");
const OrdBuildPlugin = require("../../lib/build");
const { BUILD_DEFAULT_PATH, ORD_SERVICE_NAME } = require("../../lib/constants");
const index = require("../../lib/index");

jest.mock("@sap/cds-dk", () => {
    return {
        build: {
            Plugin: class {
                constructor() {
                    this.task = {
                        dest: "",
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
            },
        },
    };
});

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

describe("Build", () => {
    beforeAll(() => {
        process.env.DEBUG = "true";
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it("should create an instance of OrdBuildPlugin", () => {
        const buildClass = new OrdBuildPlugin();
        expect(buildClass).toBeInstanceOf(OrdBuildPlugin);
    });

    it("should set the task destination to gen/ord", () => {
        const buildClass = new OrdBuildPlugin();
        buildClass.init();
        expect(buildClass.task.dest).toBe(cds.utils.path.join(cds.root, BUILD_DEFAULT_PATH));
    });

    it("should write the ord document and resources files", async () => {
        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(OrdBuildPlugin.prototype, "_writeResourcesFiles").mockImplementation((resObj, model, promises) => {
            for (const resource of resObj) {
                const subDir = cds.utils.path.join(cds.root, BUILD_DEFAULT_PATH, resource.ordId);
                for (const resourceDefinition of resource.resourceDefinitions) {
                    const url = resourceDefinition.url;
                    const fileName = url.split("/").pop();
                    promises.push(Promise.resolve(`Writing ${fileName} to ${subDir}`));
                }
            }
        });
        const buildClass = new OrdBuildPlugin();
        const promise = await buildClass.build();
        expect(buildClass._writeResourcesFiles).toHaveBeenCalledTimes(2);
        expect(promise.length).toEqual(5);
    });

    it("should not write resources files when eventResources is empty", async () => {
        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(OrdBuildPlugin.prototype, "_writeResourcesFiles").mockImplementation((resObj, model, promises) => {
            for (const resource of resObj) {
                const subDir = cds.utils.path.join(cds.root, BUILD_DEFAULT_PATH, resource.ordId);
                for (const resourceDefinition of resource.resourceDefinitions) {
                    const url = resourceDefinition.url;
                    const fileName = url.split("/").pop();
                    promises.push(Promise.resolve(`Writing ${fileName} to ${subDir}`));
                }
            }
        });

        const mockModel = {};
        const mockOrdDocument = {
            apiResources: [
                {
                    ordId: "sap.sm:apiResource:SupplierService:v1",
                    resourceDefinitions: [{ url: "https://example.com/resource1" }],
                },
            ],
        };
        jest.spyOn(index, "ord").mockReturnValue(mockOrdDocument);

        const plugin = new OrdBuildPlugin();
        plugin.model = jest.fn().mockResolvedValue(mockModel);
        const buildClass = new OrdBuildPlugin();
        const promise = await buildClass.build();
        expect(buildClass._writeResourcesFiles).toHaveBeenCalledTimes(1);
    });

    it("should output error when getMetadata failed", async () => {
        jest.spyOn(console, "log").mockImplementation(() => {});
        const getMetadataMock = jest.spyOn(require("../../lib/index"), "getMetadata");
        const errorMessage = "Failed to get metadata";
        getMetadataMock.mockImplementation(() => {
            throw new Error(errorMessage);
        });

        const buildClass = new OrdBuildPlugin();
        const resObj = [
            {
                ordId: "sap.sm:apiResource:SupplierService:v1",
                resourceDefinitions: [
                    {
                        url: "https://example.com/resource1",
                    },
                ],
            },
        ];
        const promise = [];
        await buildClass._writeResourcesFiles(resObj, {}, promise);
        expect(console.log).toHaveBeenCalledTimes(1);
        expect(promise.length).toEqual(0);
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
        const updatedOrdDocument = buildClass.postProcess(ordDocument);
        expect(updatedOrdDocument.apiResources[0].resourceDefinitions[0].url).toBe(
            path.join("customer.sample_apiResource_ProcessorService_v1", "ProcessorService.oas3.json"),
        );
        expect(updatedOrdDocument.eventResources[0].resourceDefinitions[0].url).toBe(
            path.join("customer.sample_eventResource_ProcessorService_v1", "ProcessorService.asyncapi2.json"),
        );
    });
});
