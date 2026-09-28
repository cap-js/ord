const mockGet = jest.fn();

jest.mock("@sap/cds", () => {
    class ApplicationService {
        constructor() {
            this.path = "/.well-known/open-resource-discovery";
        }

        async init() {}
    }

    return {
        ApplicationService,
        app: { get: mockGet },
        env: { requires: { toggles: true, extensibility: false } },
        model: {},
        on: jest.fn(),
    };
});

jest.mock("../../lib/ord.js", () => jest.fn(() => ({})));
jest.mock("../../lib/logger.js", () => ({ error: jest.fn(), info: jest.fn() }));
jest.mock("../../lib/defaults.js", () => ({
    adjustForPerspective: jest.fn(),
    baseTemplate: jest.fn(),
    sizeLimit: 100,
}));
jest.mock("../../lib/common/slice.js", () => ({ slice: jest.fn() }));
jest.mock("../../lib/common/utils.js", () => ({ localize: jest.fn() }));
jest.mock("../../lib/meta-data.js", () => jest.fn());
jest.mock("../../lib/auth/authentication.js", () => ({
    createAuthConfig: jest.fn(() => ({})),
    createAuthMiddleware: jest.fn(() => jest.fn()),
}));
jest.mock("../../lib/extend-ord-with-custom.js", () => ({ getCustomORDContent: jest.fn() }));

const Logger = require("../../lib/logger.js");
const { OpenResourceDiscoveryService } = require("../../lib/services/ord-service.js");

const MODEL_RESOLUTION_ERROR = new Error("Model provider unavailable");

const createResponse = () => {
    const response = {};
    response.status = jest.fn(() => response);
    response.send = jest.fn(() => response);
    return response;
};

const initializeService = async () => {
    const service = new OpenResourceDiscoveryService();
    await service.init();
};

describe("ORD service route error handling", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(OpenResourceDiscoveryService, "resolveFeatureToggles").mockRejectedValue(MODEL_RESOLUTION_ERROR);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("returns 500 when resolving feature toggles for the configuration document fails", async () => {
        await initializeService();
        const [, handler] = mockGet.mock.calls.find(([path]) => path === "/.well-known/open-resource-discovery");
        const response = createResponse();

        await expect(handler({ headers: { "local-tenant-id": "tenant-1" } }, response)).resolves.toBe(response);

        expect(OpenResourceDiscoveryService.resolveFeatureToggles).toHaveBeenCalledWith("tenant-1");
        expect(Logger.error).toHaveBeenCalledWith(
            MODEL_RESOLUTION_ERROR,
            "Error while processing the ORD configuration document",
        );
        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.send).toHaveBeenCalledWith(MODEL_RESOLUTION_ERROR.message);
    });

    test("returns 500 when resolving the default feature toggles for the document fails", async () => {
        jest.spyOn(OpenResourceDiscoveryService, "resolveDefaultFeatureToggles").mockRejectedValue(MODEL_RESOLUTION_ERROR);
        await initializeService();
        const [, , handler] = mockGet.mock.calls.find(([path]) => path === "/ord/v1/documents/ord-document");
        const response = createResponse();

        await expect(handler({ headers: {}, query: {} }, response)).resolves.toBe(response);

        expect(OpenResourceDiscoveryService.resolveDefaultFeatureToggles).toHaveBeenCalledWith();
        expect(Logger.error).toHaveBeenCalledWith(MODEL_RESOLUTION_ERROR, "Error while processing the ORD document");
        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.send).toHaveBeenCalledWith(MODEL_RESOLUTION_ERROR.message);
    });
});
