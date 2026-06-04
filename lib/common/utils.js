const _ = require("lodash");
const cds = require("@sap/cds");

const Logger = require("../logger");
const {
    ENTITY_RELATIONSHIP_ANNOTATION,
    DATA_PRODUCT_ANNOTATION,
    DATA_PRODUCT_TYPE,
    DATA_PRODUCT_SIMPLE_ANNOTATION,
    RESOURCE_VISIBILITY,
    SUPPORTED_IMPLEMENTATIONSTANDARD_VERSIONS,
    EXTERNAL_DP_ORD_ID_ANNOTATION,
    CDS_ELEMENT_KIND,
    ORD_ACCESS_STRATEGY,
} = require("../constants");

const DEFAULT_ACCESS_STRATEGIES = Object.freeze([ORD_ACCESS_STRATEGY.Open]);

function prune(object) {
    return Object.fromEntries(
        Object.entries(object) // remove unused packages
            .filter(([, value]) => value !== null && value !== undefined) // remove empty fields
            .filter(([, value]) => typeof value !== "object" || Object.keys(value).length > 0), // remove empty arrays/objects
    );
}

function getRFC3339Date() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hours = String(now.getUTCHours()).padStart(2, "0");
    const minutes = String(now.getUTCMinutes()).padStart(2, "0");
    const seconds = String(now.getUTCSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+01:00`;
}

function isPrimaryDataProductService(service) {
    return service[DATA_PRODUCT_ANNOTATION] === DATA_PRODUCT_TYPE.primary || !!service[DATA_PRODUCT_SIMPLE_ANNOTATION];
}

function resolveVisibility(appConfig, service) {
    const explicit = service["@ORD.Extensions.visibility"];
    const standard = service["@ORD.Extensions.implementationStandard"];
    let defaultVisibility = appConfig.env?.defaultVisibility ?? RESOURCE_VISIBILITY.public;

    //check for supported custom visibility value in defaultVisibility variable
    if (!Object.values(RESOURCE_VISIBILITY).includes(defaultVisibility)) {
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
}

function resolveServiceName(appConfig, { name }) {
    return (
        [
            appConfig.internalNamespace, //
            appConfig.ordNamespace, //
        ]
            .filter(Boolean)
            .filter((namespace) => name === namespace || name.startsWith(`${namespace}.`))
            .map((namespace) => name.substring(namespace.length))
            .shift()
            ?.replace(/^\./, "") ?? name
    );
}

function flattenEntityGraph(current, processed = []) {
    return [
        current, //
        ...Object.values(current.associations ?? []) //
            .filter(({ target }) => !processed.includes(target))
            .flatMap(({ target, _target }) => {
                processed.push(target);
                return flattenEntityGraph(_target, processed);
            }),
    ];
}

function readORDExtensions(model, prefix = "@ORD.Extensions.") {
    return Object.entries(model) //
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => [key.substring(prefix.length), value])
        .reduce((result, [key, value]) => _.set(result, key, value), {});
}

function isExternalDataProduct(definition) {
    return !!(
        definition.kind === "service" &&
        definition["@cds.external"] &&
        definition[DATA_PRODUCT_SIMPLE_ANNOTATION] &&
        definition[EXTERNAL_DP_ORD_ID_ANNOTATION]
    );
}

function isExposedEntityType(definition) {
    return (
        !definition.name.includes(".texts") &&
        definition[ENTITY_RELATIONSHIP_ANNOTATION] &&
        definition.kind === CDS_ELEMENT_KIND.entity &&
        definition["_service"]?.["@protocol"] !== "none" &&
        !isBlockedServiceName(definition["_service"]?.name)
    );
}

function isBlockedServiceName(name) {
    return ["cds.xt.MTXServices", "MtxOrdProviderService", "OpenResourceDiscoveryService"] //
        .some((blocked) => name?.includes(blocked));
}

function isValidService(definition) {
    const isExternalService =
        Object.keys(cds).includes("requires") && Object.keys(cds.requires).includes(definition.name);

    return (
        !isExternalService &&
        !definition["@cds.external"] &&
        definition["@protocol"] !== "none" &&
        !isBlockedServiceName(definition.name) &&
        definition.kind === CDS_ELEMENT_KIND.service
    );
}

function isEventsOnlyService(definition) {
    return (
        Object.keys(definition.events || {}).length > 0 &&
        ["actions", "entities", "functions"].every((key) => Object.keys(definition[key] || {}).length === 0)
    );
}

function resolveAccessStrategies(authConfig, options = {}) {
    const isStrict = options?.strict ?? cds.env.ord?.strictAccessStrategies === true;
    const strategies = _.uniq(authConfig.accessStrategies ?? [])
        .flatMap((strategy) => {
            if (!Object.values(ORD_ACCESS_STRATEGY).includes(strategy)) {
                Logger.warn("resolveAccessStrategies:", `Unknown access strategy type '${strategy}', skipping`);
                return null;
            }

            return strategy;
        })
        .filter(Boolean); // Remove null entries

    if (isStrict && strategies.length === 0) {
        throw new Error("[ORD] accessStrategies missing or empty for resource. Strict mode is enabled");
    }

    if (strategies.length > 1 && strategies.includes(ORD_ACCESS_STRATEGY.Open)) {
        throw new Error(
            "Invalid access strategies: 'open' cannot coexist with authenticated strategies (basic-auth, sap:cmp-mtls:v1, sap.businesshub:mtls:v1)",
        );
    }

    return (strategies.length > 0 ? strategies : DEFAULT_ACCESS_STRATEGIES) //
        .map((strategy) => ({ type: strategy }));
}

module.exports = {
    prune,
    isValidService,
    getRFC3339Date,
    readORDExtensions,
    resolveVisibility,
    flattenEntityGraph,
    resolveServiceName,
    isExposedEntityType,
    isEventsOnlyService,
    isBlockedServiceName,
    isExternalDataProduct,
    resolveAccessStrategies,
    isPrimaryDataProductService,
};
