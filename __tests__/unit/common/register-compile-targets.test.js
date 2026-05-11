const cds = require("@sap/cds");

jest.mock("../../../lib/logger", () => ({ warn: jest.fn() }));
jest.mock("@cap-js/graphql/lib/api");
jest.mock("@cap-js/mcp/lib/api", () => ({ registerCompileTargets: jest.fn() }), { virtual: true });

const Logger = require("../../../lib/logger");
const graphqlApi = require("@cap-js/graphql/lib/api");
const mcpApi = require("@cap-js/mcp/lib/api");
const registerCompileTargets = require("../../../lib/common/register-compile-targets");

describe("register-compile-targets", () => {
    let savedPlugins;
    let savedProtocols;

    beforeEach(() => {
        savedPlugins = { ...cds.env.plugins };
        savedProtocols = { ...cds.env.protocols };
        cds.env.plugins = {};
        delete cds.env.protocols.graphql;
        delete cds.env.protocols.mcp;

        graphqlApi.registerCompileTargets = jest.fn();
        mcpApi.registerCompileTargets = jest.fn();
        jest.clearAllMocks();
    });

    afterEach(() => {
        cds.env.plugins = savedPlugins;
        cds.env.protocols = savedProtocols;
    });

    it("does nothing when no plugins are configured", () => {
        registerCompileTargets();

        expect(cds.env.protocols.graphql).toBeUndefined();
        expect(cds.env.protocols.mcp).toBeUndefined();
        expect(Logger.warn).not.toHaveBeenCalled();
    });

    it("does nothing when plugins is undefined", () => {
        delete cds.env.plugins;

        registerCompileTargets();

        expect(Logger.warn).not.toHaveBeenCalled();
    });

    it("does nothing for plugins not in PROTOCOL_PROVIDERS", () => {
        cds.env.plugins = { "@cap-js/unknown-plugin": {} };

        registerCompileTargets();

        expect(cds.env.protocols.graphql).toBeUndefined();
        expect(cds.env.protocols.mcp).toBeUndefined();
        expect(Logger.warn).not.toHaveBeenCalled();
    });

    it("registers graphql protocol when @cap-js/graphql is installed and protocol is absent", () => {
        cds.env.plugins = { "@cap-js/graphql": {} };

        registerCompileTargets();

        expect(cds.env.protocols.graphql).toEqual({ path: "/graphql", impl: "@cap-js/graphql" });
    });

    it("does not overwrite graphql protocol when already registered", () => {
        cds.env.plugins = { "@cap-js/graphql": {} };
        cds.env.protocols.graphql = { path: "/custom-graphql", impl: "@cap-js/graphql" };

        registerCompileTargets();

        expect(cds.env.protocols.graphql.path).toBe("/custom-graphql");
    });

    it("registers mcp protocol when @cap-js/mcp is installed and protocol is absent", () => {
        cds.env.plugins = { "@cap-js/mcp": {} };

        registerCompileTargets();

        expect(cds.env.protocols.mcp).toEqual({ path: "/mcp", impl: "@cap-js/mcp" });
    });

    it("calls registerCompileTargets on the plugin api module", () => {
        cds.env.plugins = { "@cap-js/graphql": {} };

        registerCompileTargets();

        expect(graphqlApi.registerCompileTargets).toHaveBeenCalledTimes(1);
    });

    it("does not throw when plugin api module has no registerCompileTargets export", () => {
        cds.env.plugins = { "@cap-js/graphql": {} };
        delete graphqlApi.registerCompileTargets;

        expect(() => registerCompileTargets()).not.toThrow();
        expect(cds.env.protocols.graphql).toEqual({ path: "/graphql", impl: "@cap-js/graphql" });
    });

    it("logs a warning and continues when a plugin api call throws", () => {
        cds.env.plugins = { "@cap-js/graphql": {}, "@cap-js/mcp": {} };
        graphqlApi.registerCompileTargets = () => {
            throw new Error("unexpected failure");
        };

        registerCompileTargets();

        expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining("@cap-js/graphql"));
        expect(cds.env.protocols.mcp).toEqual({ path: "/mcp", impl: "@cap-js/mcp" });
    });

    it("registers both graphql and mcp when both plugins are present", () => {
        cds.env.plugins = { "@cap-js/graphql": {}, "@cap-js/mcp": {} };

        registerCompileTargets();

        expect(cds.env.protocols.graphql).toEqual({ path: "/graphql", impl: "@cap-js/graphql" });
        expect(cds.env.protocols.mcp).toEqual({ path: "/mcp", impl: "@cap-js/mcp" });
    });
});