const cds = require("@sap/cds");

const { createAgents, createAgentTemplate } = require("../../../lib/templates/agent");
const { createAPIResourceTemplate } = require("../../../lib/templates/api-resource");
const { createPackages } = require("../../../lib/templates/package");
const { ORD_ACCESS_STRATEGY, ORD_API_PROTOCOL } = require("../../../lib/constants");

const baseAppConfig = {
    ordNamespace: "customer.testNamespace",
    appName: "testAppName",
    packageName: "TestPackage",
    lastUpdate: "2022-12-19T15:47:04+00:00",
    policyLevels: ["none"],
    accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
    env: {},
};

let previousAgentProtocol;

beforeEach(() => {
    previousAgentProtocol = cds.service.protocols.agent;
    cds.service.protocols.agent = { path: "/a2a", impl: "@cap-js/agents" };
});

afterEach(() => {
    if (previousAgentProtocol === undefined) delete cds.service.protocols.agent;
    else cds.service.protocols.agent = previousAgentProtocol;
});

describe("createAgentTemplate", () => {
    it("should set required fields with defaults", () => {
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent).toMatchObject({
            ordId: "customer.testNamespace:agent:MyAgentService:v1",
            title: "MyAgentService",
            shortDescription: "Short description of MyAgentService",
            version: "1.0.0",
            releaseStatus: "active",
            visibility: "public",
            partOfPackage: "customer.testNamespace:package:testAppName:v1",
            lastUpdate: baseAppConfig.lastUpdate,
        });
    });

    it("should reference the generated package when its ORD ID is customized", () => {
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];
        const appConfig = {
            ...baseAppConfig,
            env: {
                packages: [{ ordId: "{namespace}:{type}:CustomPackage:v1" }],
            },
        };

        const agent = createAgentTemplate(service, appConfig);
        const packages = createPackages(appConfig);

        expect(agent.partOfPackage).toEqual("customer.testNamespace:package:CustomPackage:v1");
        expect(packages).toEqual(
            expect.arrayContaining([expect.objectContaining({ ordId: agent.partOfPackage })]),
        );
    });

    it("should use @ORD.Extensions.title when present", () => {
        const model = cds.linked(`
            @agent
            @ORD.Extensions.title: 'My Custom Agent Title'
            @title: 'Lower-priority title'
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.title).toEqual("My Custom Agent Title");
    });

    it("should fall back to @title when @ORD.Extensions.title is absent", () => {
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
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.title).toEqual("MyAgentService");
    });

    it("should populate description from @description annotation", () => {
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
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.description).toBeUndefined();
    });

    it("should auto-generate exposedApiResources referencing the a2a API resource", () => {
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.exposedApiResources).toEqual([
            { ordId: "customer.testNamespace:apiResource:MyAgentService:v1" },
        ]);
        expect(createAPIResourceTemplate(service, baseAppConfig)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    ordId: agent.exposedApiResources[0].ordId,
                    apiProtocol: ORD_API_PROTOCOL.A2A,
                }),
            ]),
        );
    });

    it("should reference the unsuffixed A2A resource when agent precedes OData", () => {
        const model = cds.linked(`
            @agent
            @protocol: ['agent', 'odata']
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);
        const resources = createAPIResourceTemplate(service, baseAppConfig);

        expect(resources.map(({ apiProtocol }) => apiProtocol)).toEqual([
            ORD_API_PROTOCOL.A2A,
            ORD_API_PROTOCOL.ODATA_V4,
        ]);
        expect(agent.exposedApiResources).toEqual([
            { ordId: "customer.testNamespace:apiResource:MyAgentService:v1" },
        ]);
        expect(resources).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    ordId: agent.exposedApiResources[0].ordId,
                    apiProtocol: ORD_API_PROTOCOL.A2A,
                }),
            ]),
        );
    });

    it("should reference the suffixed A2A resource when OData precedes agent", () => {
        const model = cds.linked(`
            @agent
            @protocol: ['odata', 'agent']
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);
        const resources = createAPIResourceTemplate(service, baseAppConfig);

        expect(resources.map(({ apiProtocol }) => apiProtocol)).toEqual([
            ORD_API_PROTOCOL.ODATA_V4,
            ORD_API_PROTOCOL.A2A,
        ]);
        expect(agent.exposedApiResources).toEqual([
            { ordId: "customer.testNamespace:apiResource:MyAgentService-a2a:v1" },
        ]);
        expect(resources).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    ordId: agent.exposedApiResources[0].ordId,
                    apiProtocol: ORD_API_PROTOCOL.A2A,
                }),
            ]),
        );
    });

    it("should reference the service-level ORD ID with resolved placeholders", () => {
        const model = cds.linked(`
            @agent
            @ORD.Extensions.ordId: '{namespace}:{type}:CustomAgent:v1'
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.ordId).toEqual("customer.testNamespace:agent:CustomAgent:v1");
        expect(agent.exposedApiResources).toEqual([
            { ordId: "customer.testNamespace:apiResource:CustomAgent:v1" },
        ]);
        expect(createAPIResourceTemplate(service, baseAppConfig)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    ordId: agent.exposedApiResources[0].ordId,
                    apiProtocol: ORD_API_PROTOCOL.A2A,
                }),
            ]),
        );
    });

    it("should prefer the A2A-specific ORD ID with resolved placeholders", () => {
        const model = cds.linked(`
            @agent
            @protocol: ['odata', 'agent']
            @ORD.Extensions.ordId: '{namespace}:{type}:CustomAgent:v1'
            @![protocol('a2a')].ORD.Extensions.ordId: '{namespace}:{type}:CustomA2A:v1'
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.ordId).toEqual("customer.testNamespace:agent:CustomAgent:v1");
        expect(agent.exposedApiResources).toEqual([
            { ordId: "customer.testNamespace:apiResource:CustomA2A:v1" },
        ]);
        expect(createAPIResourceTemplate(service, baseAppConfig)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    ordId: agent.exposedApiResources[0].ordId,
                    apiProtocol: ORD_API_PROTOCOL.A2A,
                }),
            ]),
        );
    });

    it("should omit the default reference when the agent protocol is not registered", () => {
        delete cds.service.protocols.agent;
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const resources = createAPIResourceTemplate(service, baseAppConfig);
        const agent = createAgentTemplate(service, baseAppConfig);

        expect(resources).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ apiProtocol: ORD_API_PROTOCOL.A2A })]),
        );
        expect(agent).not.toHaveProperty("exposedApiResources");
    });

    it("should use @ORD.Extensions.exposedApiResources when provided", () => {
        const model = cds.linked(`
            @agent
            @ORD.Extensions.exposedApiResources: [{ ordId: 'customer.testNamespace:apiResource:MyAgentService:v1' }]
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.exposedApiResources).toEqual([{ ordId: "customer.testNamespace:apiResource:MyAgentService:v1" }]);
    });

    it("should use @ORD.Extensions.ordId when provided", () => {
        const model = cds.linked(`
            @agent
            @ORD.Extensions.ordId: 'customer.testNamespace:agent:CustomAgentId:v1'
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.ordId).toEqual("customer.testNamespace:agent:CustomAgentId:v1");
    });

    it("should preserve private visibility for filtering by createAgents", () => {
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
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.lastUpdate).toEqual(baseAppConfig.lastUpdate);
    });

    it("should use @ORD.Extensions.releaseStatus when provided", () => {
        const model = cds.linked(`
            @agent
            @ORD.Extensions.releaseStatus: 'beta'
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.releaseStatus).toEqual("beta");
    });

    it("should use @ORD.Extensions.shortDescription when provided", () => {
        const model = cds.linked(`
            @agent
            @ORD.Extensions.shortDescription: 'Custom short desc'
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.shortDescription).toEqual("Custom short desc");
    });

    it("should fall back to @shortDescription when @ORD.Extensions.shortDescription is absent", () => {
        const model = cds.linked(`
            @agent
            @shortDescription: 'Fallback short desc'
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.shortDescription).toEqual("Fallback short desc");
    });

    it("should default shortDescription to service name prefix when not annotated", () => {
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.shortDescription).toEqual("Short description of MyAgentService");
    });

    it("should set aiHint from @ORD.Extensions.aiHint", () => {
        const model = cds.linked(`
            @agent
            @ORD.Extensions.aiHint: 'Use this agent for resolving support incidents'
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.aiHint).toEqual("Use this agent for resolving support incidents");
    });

    it("should omit aiHint when not annotated", () => {
        const model = cds.linked(`
            @agent
            service MyAgentService {}
        `);
        const service = model.definitions["MyAgentService"];

        const agent = createAgentTemplate(service, baseAppConfig);

        expect(agent.aiHint).toBeUndefined();
    });
});

describe("createAgents", () => {
    it("should return one agent per @agent-annotated service", () => {
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
        expect(agents.map(({ ordId }) => ordId)).toEqual([
            "customer.testNamespace:agent:AgentOne:v1",
            "customer.testNamespace:agent:AgentTwo:v1",
        ]);
    });

    it("should return empty array when no services are annotated with @agent", () => {
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

        expect(agents).toHaveLength(1)
        expect(agents.map(({ ordId }) => ordId)).toEqual(["customer.testNamespace:agent:PublicAgent:v1"]);
    });

    it("should not include non-service definitions", () => {
        const model = cds.linked(`
            @agent
            service AgentService {}

            @agent
            entity SomeEntity {
                key ID: UUID;
            }
        `);
        const appConfig = {
            ...baseAppConfig,
            csn: model,
        };

        const agents = createAgents(appConfig);

        expect(agents.map(({ ordId }) => ordId)).toEqual(["customer.testNamespace:agent:AgentService:v1"]);
    });
});
