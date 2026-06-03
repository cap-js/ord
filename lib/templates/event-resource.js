const _ = require("lodash");

const defaults = require("../defaults");
const { createPackages } = require("./package");
const entityTypeTemplate = require("./entity-type");
const {
    RESOURCE_VISIBILITY,
    ENTITY_RELATIONSHIP_ANNOTATION,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    CDS_ELEMENT_KIND,
} = require("../constants");
const {
    readORDExtensions,
    resolveVisibility,
    flattenEntityGraph,
    resolveServiceName,
    isValidService,
} = require("../common/utils");

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

        return (
            service["@ORD.Extensions.ordId"]?.replace(/\{type}/g, "eventResource")?.replace(/\{namespace}/g, namespace) ??
            `${namespace}:eventResource:${name}:${version}`
        );
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
    exposedEntityTypes: (service, appConfig) => {
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
                            : [entityTypeTemplate.RESOLVERS.ordId(entity, appConfig)]),
                    ];
                }),
        );

        return service["@ORD.Extensions.exposedEntityTypes"] ?? [...ordIds].map((ordId) => ({ ordId: ordId }));
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
            service["@ORD.Extensions.partOfPackage"]?.replace(/\{namespace}/g, namespace) ??
            [`${namespace}:package:${name}-event${suffix}:v1`, `${namespace}:package:${name}:v1`] //
                .find((candidate) => packages.includes(candidate))
        );
    },
    resourceDefinitions: (service, appConfig) => {
        const name = service.name;
        const ordId = RESOLVERS.ordId(service, appConfig);
        const accessStrategies = appConfig.accessStrategies;

        return (
            service["@ORD.Extensions.resourceDefinitions"] ?? [
                {
                    type: "asyncapi-v2",
                    mediaType: `application/json`,
                    url: `/ord/v1/${ordId}/${name}.asyncapi2.json`,
                    accessStrategies: accessStrategies,
                },
            ]
        );
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
function createEventResourceTemplate(service, appConfig) {
    const exposedEntityTypes = RESOLVERS.exposedEntityTypes(service, appConfig);

    return {
        releaseStatus: "active",
        extensible: { supported: "no" },
        lastUpdate: appConfig.lastUpdate,
        shortDescription: `${service.name} event resource`,

        ...readORDExtensions(service),

        version: RESOLVERS.version(service),
        ordId: RESOLVERS.ordId(service, appConfig),
        title: RESOLVERS.title(service, appConfig),
        description: RESOLVERS.description(service),
        visibility: RESOLVERS.visibility(service, appConfig),
        partOfGroups: RESOLVERS.partOfGroups(service, appConfig),
        partOfPackage: RESOLVERS.partOfPackage(service, appConfig),
        resourceDefinitions: RESOLVERS.resourceDefinitions(service, appConfig),

        ...(exposedEntityTypes.length && { exposedEntityTypes }),
    };
}

function createEventResources(appConfig) {
    const services = _.uniqBy(
        Object.values(appConfig.csn.definitions)
            .filter((definition) => definition.kind === CDS_ELEMENT_KIND.event)
            .filter((definition) => isValidService(definition["_service"]))
            .map((definition) => definition["_service"]),
        "name",
    );

    return services
        .map((service) => createEventResourceTemplate(service, appConfig))
        .filter((resource) => resource.visibility !== RESOURCE_VISIBILITY.private);
}

module.exports = {
    createEventResources,
    createEventResourceTemplate,
    RESOLVERS,
};
