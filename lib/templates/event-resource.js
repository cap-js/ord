const defaults = require("../defaults");
const entityTypeTemplate = require("./entity-type");
const { ensureAccessStrategies, getAccessStrategiesFromAuthConfig } = require("../access-strategies");
const { readORDExtensions, resolveVisibility, flattenEntityGraph, resolveServiceName } = require("../common/utils");
const { RESOURCE_VISIBILITY, ENTITY_RELATIONSHIP_ANNOTATION, ORD_ODM_ENTITY_NAME_ANNOTATION } = require("../constants");

const RESOLVERS = Object.freeze({
    version: (service) => {
        return service["@ORD.Extensions.version"] ?? "1.0.0";
    },
    description: (service) => {
        return (
            service["@ORD.Extensions.description"] ??
            service["@description"] ??
            service["@Core.Description"] ??
            "CAP Event resource describing events / messages."
        );
    },
    ordId: (service, appConfig) => {
        const namespace = appConfig.ordNamespace;
        const name = resolveServiceName(appConfig, service);
        const version = `v${RESOLVERS.version(service).split(".")[0]}`;

        return service["@ORD.Extensions.ordId"] ?? `${namespace}:eventResource:${name}:${version}`;
    },
    title: (service, appConfig) => {
        return (
            service["@ORD.Extensions.title"] ??
            service["@title"] ??
            service["@Common.Label"] ??
            service["@EndUserText.label"] ??
            `ODM ${appConfig.appName.replace(/[^a-zA-Z0-9]/g, "")} Events`
        );
    },
    exposedEntityTypes: (service) => {
        const ordIds = new Set(
            Object.values(service.entities ?? {})
                .flatMap((entity) => flattenEntityGraph(entity))
                .flatMap((entity) => {
                    return [
                        ...(!entity[ORD_ODM_ENTITY_NAME_ANNOTATION]
                            ? []
                            : [`sap.odm:entityType:${entity[ORD_ODM_ENTITY_NAME_ANNOTATION]}:v1`]),
                        ...(!entity[ENTITY_RELATIONSHIP_ANNOTATION]
                            ? []
                            : [entityTypeTemplate.RESOLVERS.ordId(entity)]),
                    ];
                }),
        );

        return [...ordIds].map((ordId) => ({ ordId: ordId }));
    },
    visibility: (service, appConfig) => {
        return resolveVisibility(appConfig, service);
    },
    partOfGroups: (service, appConfig) => {
        const namespace = appConfig.ordNamespace;
        const name = resolveServiceName(appConfig, service);

        return [`${defaults.groupTypeId}:${namespace}:${name}`];
    },
    partOfPackage: (service, appConfig) => {
        const visibility = RESOLVERS.visibility(service, appConfig);
        const name = appConfig.appName?.replace(/[^a-zA-Z0-9]/g, "");
        const packages = defaults.packages(appConfig).map((pkg) => pkg.ordId);
        const suffix = visibility === RESOURCE_VISIBILITY.public ? "" : `-${visibility}`;

        return (
            service["@ORD.Extensions.partOfPackage"] ??
            [
                `${appConfig.ordNamespace}:package:${name}-event${suffix}:v1`,
                `${appConfig.ordNamespace}:package:${name}:v1`,
            ].find((candidate) => packages.includes(candidate))
        );
    },
    resourceDefinitions: (service, appConfig) => {
        const name = service.name;
        const ordId = RESOLVERS.ordId(service, appConfig);
        const accessStrategies = getAccessStrategiesFromAuthConfig(appConfig.authConfig.accessStrategies);

        return [
            {
                type: "asyncapi-v2",
                mediaType: `application/json`,
                url: `/ord/v1/${ordId}/${name}.asyncapi2.json`,
                accessStrategies: ensureAccessStrategies(accessStrategies, {
                    resourceName: `${name} (asyncapi-v2)`,
                }),
            },
        ];
    },
});

/**
 * This is a template function to create Event Resource object.
 * There can be only one event resource per service because all events are using the same protocol, they are always Cloud Events.
 * Properties of an event resource can be overwritten by the ORD extensions. Example: visibility.
 * Ensures proper visibility compliance by checking associated EntityTypes.
 *
 * @param {object} service The definition of the service
 * @param {object} appConfig - The application configuration.
 * @returns {object} An object representing the Event Resource.
 */
const createEventResourceTemplate = (service, appConfig) => {
    const exposedEntityTypes = RESOLVERS.exposedEntityTypes(service);

    return {
        releaseStatus: "active",
        extensible: { supported: "no" },
        lastUpdate: appConfig.lastUpdate,
        shortDescription: `${service.name} event resource`,

        version: RESOLVERS.version(service),
        ordId: RESOLVERS.ordId(service, appConfig),
        title: RESOLVERS.title(service, appConfig),
        description: RESOLVERS.description(service),
        visibility: RESOLVERS.visibility(service, appConfig),
        partOfGroups: RESOLVERS.partOfGroups(service, appConfig),
        partOfPackage: RESOLVERS.partOfPackage(service, appConfig),
        resourceDefinitions: RESOLVERS.resourceDefinitions(service, appConfig),

        ...(exposedEntityTypes.length && { exposedEntityTypes }),

        ...readORDExtensions(service),
    };
};

module.exports = {
    createEventResourceTemplate,
    RESOLVERS,
};
