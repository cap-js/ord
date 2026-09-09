const cds = require("@sap/cds");

const { createAgents, createAgentTemplate, RESOLVERS } = require("../../../lib/templates/agent");
const { ORD_ACCESS_STRATEGY } = require("../../../lib/constants");

const baseAppConfig = {
    ordNamespace: "customer.testNamespace",
    appName: "testAppName",
    packageName: "TestPackage",
    lastUpdate: "2022-12-19T15:47:04+00:00",
    policyLevels: ["none"],
    accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
    env: {},
};

describe("createAgentTemplate", () => {
    it("should set required fields with defaults", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.ordId).toEqual("customer.testNamespace:agent:MyAgentService:v1");
        expect(agent.version).toEqual("1.0.0");
        expect(agent.releaseStatus).toEqual("beta");
        expect(agent.visibility).toEqual("public");
        expect(agent.partOfPackage).toBeDefined();
    });

    it("should use @ORD.Extensions.title when present", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            @agent
            @ORD.Extensions.title: 'My Custom Agent Title'
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.title).toEqual("My Custom Agent Title");
    });

    it("should fall back to @title when @ORD.Extensions.title is absent", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            @agent
            @title: 'Fallback Title'
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.title).toEqual("Fallback Title");
    });

    it("should fall back to service local name when no title annotation is present", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.title).toEqual("MyAgentService");
    });

    it("should populate description from @description annotation", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            @agent
            @description: 'An AI agent for incident management'
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.description).toEqual("An AI agent for incident management");
    });

    it("should omit description when not annotated", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.description).toBeUndefined();
    });

    it("should generate exposedApiResources cross-reference pointing to the matching apiResource ordId", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.exposedApiResources).toHaveLength(1);
        expect(agent.exposedApiResources[0].ordId).toEqual("customer.testNamespace:apiResource:MyAgentService:v1");
    });

    it("should use @ORD.Extensions.ordId when provided", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            @agent
            @ORD.Extensions.ordId: 'customer.testNamespace:agent:CustomAgentId:v1'
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.ordId).toEqual("customer.testNamespace:agent:CustomAgentId:v1");
    });

    it("should not include private agents", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            @agent
            @ORD.Extensions.visibility: 'private'
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.visibility).toEqual("private");
    });

    it("should include lastUpdate from appConfig", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.lastUpdate).toEqual(baseAppConfig.lastUpdate);
    });
});

describe("createAgents", () => {
    it("should return one agent per @agent-annotated service", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            @agent
            service AgentOne {}

            @agent
            service AgentTwo {}
        `);
        const appConfig = {
            ...baseAppConfig,
            csn: model,
        };

        const agents = createAgents(appConfig);

        expect(agents).toHaveLength(2);
    });

    it("should return empty array when no services are annotated with @agent", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            service NonAgentService {}
        `);
        const appConfig = {
            ...baseAppConfig,
            csn: model,
        };

        const agents = createAgents(appConfig);

        expect(agents).toHaveLength(0);
    });

    it("should not include private agents in the result", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            @agent
            @ORD.Extensions.visibility: 'private'
            service PrivateAgent {}

            @agent
            service PublicAgent {}
        `);
        const appConfig = {
            ...baseAppConfig,
            csn: model,
        };

        const agents = createAgents(appConfig);

        expect(agents).toHaveLength(1);
        expect(agents[0].ordId).toContain("PublicAgent");
    });

    it("should not include non-service definitions", () => {
        // TODO: Review AI Test
        const model = cds.linked(`
            @agent
            service AgentService {}

            entity SomeEntity {
                key ID: UUID;
            }
        `);
        const appConfig = {
            ...baseAppConfig,
            csn: model,
        };

        const agents = createAgents(appConfig);

        expect(agents).toHaveLength(1);
    });
});
