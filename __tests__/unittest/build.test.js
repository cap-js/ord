const cds = require("@sap/cds");
const OrdBuildPlugin = require("../../lib/build");
const { BUILD_DEFAULT_PATH, ORD_SERVICE_NAME } = require("../../lib/constants");

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
        jest.spyOn(console, "log").mockImplementation(() => { });
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

    it("should skip when OpenResourceDiscoveryService founded", async () => {
        jest.spyOn(console, "log").mockImplementation(() => { });
        const buildClass = new OrdBuildPlugin();
        const resObj = [
            {
                ordId: ORD_SERVICE_NAME,
                resourceDefinitions: [
                    {
                        url: "https://example.com/resource1",
                    },
                ],
            },
        ];
        const promise = [];
        await buildClass._writeResourcesFiles(resObj, {}, promise);
        expect(console.log).toHaveBeenCalledTimes(0);
        expect(promise.length).toEqual(0);
    });

    it("should output error when getMetadata failed", async () => {
        jest.spyOn(console, "log").mockImplementation(() => { });
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

    it("should update resource URLs with relative paths", () => {
        const buildClass = new OrdBuildPlugin();
        const ordDocument = {
            apiResources: [
                {
                    ordId: "sap.sm:apiResource:SupplierService:v1",
                    resourceDefinitions: [
                        { url: "/ord/v1/resource1" },
                        { url: "/ord/v1/resource2" },
                    ],
                },
            ],
            eventResources: [
                {
                    ordId: "sap.sm:eventResource:SupplierService:v1",
                    resourceDefinitions: [
                        { url: "/ord/v1/event1" },
                        { url: "/ord/v1/event2" },
                    ],
                },
            ],
        };
        const updatedOrdDocument = buildClass.postProcessWithRelativePath(ordDocument);
        expect(updatedOrdDocument.apiResources[0].resourceDefinitions[0].url).toBe(
            `${BUILD_DEFAULT_PATH}/resource1`
        );
        expect(updatedOrdDocument.eventResources[0].resourceDefinitions[0].url).toBe(
            `${BUILD_DEFAULT_PATH}/event1`
        );
    });
});
