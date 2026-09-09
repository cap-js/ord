const _ = require("lodash");

const defaults = require("../defaults");
const { prune } = require("../common/utils");
const { createPackages } = require("./package");
const placeholders = require("../common/placeholders");
const { readORDExtensions, resolveVisibility, resolveServiceName, isValidService } = require("../common/utils");
const { RESOURCE_VISIBILITY, AGENT_ANNOTATION, SHORT_DESCRIPTION_PREFIX, ORD_API_PROTOCOL } = require("../constants");

const RESOLVERS = Object.freeze({
    version: (service) => {
        return service["@ORD.Extensions.version"] ?? "1.0.0";
    },
    description: (service) => {
        return (
            service["@ORD.Extensions.description"] ??
            service["@description"] ??
            service["@Core.Description"] ??
            undefined
        );
    },
    ordId: (service, appConfig) => {
        const name = resolveServiceName(appConfig, service);
        const version = `v${RESOLVERS.version(service).split(".")[0]}`;

        return placeholders.replace(service["@ORD.Extensions.ordId"] ?? `{namespace}:{type}:${name}:${version}`, {
            type: "agent",
            namespace: appConfig.ordNamespace,
        });
    },
    title: (service, appConfig) => {
        return (
            service["@ORD.Extensions.title"] ??
            service["@title"] ??
            service["@Common.Label"] ??
            service["@EndUserText.label"] ??
            resolveServiceName(appConfig, service)
        );
    },
    visibility: (service, appConfig) => {
        return resolveVisibility(appConfig, service);
    },
    partOfGroups: (service, appConfig) => {
        const namespace = appConfig.ordNamespace;
        const name = resolveServiceName(appConfig, service);

        return service["@ORD.Extensions.partOfGroups"] ?? [`${defaults.groupTypeId}:${namespace}:${name}`];
    },
    partOfPackage: (service, appConfig) => {
        const namespace = appConfig.ordNamespace;
        const visibility = RESOLVERS.visibility(service, appConfig);
        const name = appConfig.appName?.replace(/[^a-zA-Z0-9]/g, "");
        const packages = createPackages(appConfig).map((pkg) => pkg.ordId);
        const suffix = visibility === RESOURCE_VISIBILITY.public ? "" : `-${visibility}`;

        return (
            placeholders.replace(service["@ORD.Extensions.partOfPackage"], { type: "package", namespace: namespace }) ??
            [`${namespace}:package:${name}-api${suffix}:v1`, `${namespace}:package:${name}:v1`].find((candidate) =>
                packages.includes(candidate),
            )
        );
    },
    releaseStatus: (service) => {
        return service["@ORD.Extensions.releaseStatus"] ?? "active";
    },
    shortDescription: (service, appConfig) => {
        const name = resolveServiceName(appConfig, service);
        return (
            service["@ORD.Extensions.shortDescription"] ??
            service["@shortDescription"] ??
            SHORT_DESCRIPTION_PREFIX + name
        );
    },
    exposedApiResources: (service, appConfig) => {
        const name = resolveServiceName(appConfig, service);
        const version = `v${RESOLVERS.version(service).split(".")[0]}`;
        const extensions = readORDExtensions(service, `@protocol('${ORD_API_PROTOCOL.A2A}').ORD.Extensions.`);

        return [
            {
                ordId: placeholders.replace(extensions?.ordId ?? `{namespace}:{type}:${name}:${version}`, {
                    type: "apiResource",
                    namespace: appConfig.ordNamespace,
                }),
            },
        ];
    },
});

function createAgentTemplate(service, appConfig) {
    return prune({
        releaseStatus: RESOLVERS.releaseStatus(service),
        lastUpdate: appConfig.lastUpdate,

        version: RESOLVERS.version(service),
        ordId: RESOLVERS.ordId(service, appConfig),
        title: RESOLVERS.title(service, appConfig),
        shortDescription: RESOLVERS.shortDescription(service, appConfig),
        description: RESOLVERS.description(service),
        visibility: RESOLVERS.visibility(service, appConfig),
        partOfGroups: RESOLVERS.partOfGroups(service, appConfig),
        partOfPackage: RESOLVERS.partOfPackage(service, appConfig),
        exposedApiResources: RESOLVERS.exposedApiResources(service, appConfig),

        ..._.omit(readORDExtensions(service), Object.keys(RESOLVERS)),
    });
}

function createAgents(appConfig) {
    return Object.values(appConfig.csn.definitions)
        .filter((definition) => isValidService(definition) && definition[AGENT_ANNOTATION])
        .map((service) => createAgentTemplate(service, appConfig))
        .filter((agent) => agent.visibility !== RESOURCE_VISIBILITY.private);
}

module.exports = { createAgents, createAgentTemplate, RESOLVERS };
