const Logger = require("../logger");
const defaults = require("../defaults");
const entityTypeTemplate = require("./entity-type");
const { ensureAccessStrategies, getAccessStrategiesFromAuthConfig } = require("../access-strategies");
const { readORDExtensions, flattenEntityGraph, isPrimaryDataProductService } = require("../common/utils");
const {
    ALLOWED_VISIBILITY,
    RESOURCE_VISIBILITY,
    ENTITY_RELATIONSHIP_ANNOTATION,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    SUPPORTED_IMPLEMENTATIONSTANDARD_VERSIONS,
} = require("../constants");

function _getCleanServiceName(name, appConfig) {
    return (
        [
            appConfig.internalNamespace, //
            appConfig.ordNamespace, //
        ]
            .filter(Boolean)
            .filter((namespace) => name === namespace || name.startsWith(`${namespace}.`))
            .map((namespace) => name.substring(namespace.length))
            .pop()
            ?.replace(/^\./, "") ?? name
    );
}

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
        const name = _getCleanServiceName(service.name, appConfig);
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
        const explicit = service["@ORD.Extensions.visibility"];
        const standard = service["@ORD.Extensions.implementationStandard"];
        let defaultVisibility = appConfig.env?.defaultVisibility ?? RESOURCE_VISIBILITY.public;

        //check for supported custom visibility value in defaultVisibility variable
        if (!ALLOWED_VISIBILITY.includes(defaultVisibility)) {
            Logger.warn(
                `Default visibility ${defaultVisibility} is not supported. Using ${RESOURCE_VISIBILITY.public} as fallback`,
            );
            defaultVisibility = RESOURCE_VISIBILITY.public;
        }

        // Determine visibility
        if (isPrimaryDataProductService(service)) {
            return RESOURCE_VISIBILITY.internal;
        } else if (explicit) {
            return service["@ORD.Extensions.visibility"];
        } else if (SUPPORTED_IMPLEMENTATIONSTANDARD_VERSIONS.includes(standard)) {
            // if the implementationStandard is for example sap:ord-document-api:v1, it should be public by default
            return RESOURCE_VISIBILITY.public;
        }

        return defaultVisibility;
    },
    partOfGroups: (service, appConfig) => {
        const namespace = appConfig.ordNamespace;
        const name = _getCleanServiceName(service.name, appConfig);

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
 * This is a template function to create Event Resource object for Event Resource Array.
 * There can be only one event resource per service because all events are using the same protocol, they are always Cloud Events.
 * Properties of an event resource can be overwritten by the ORD extensions. Example: visibility.
 * Ensures proper visibility compliance by checking associated EntityTypes.
 *
 * @param {object} service The definition of the service
 * @param {object} appConfig - The application configuration.
 * @returns {object} An single-item array of objects for the Event Resources.
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
};
