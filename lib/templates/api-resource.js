const Logger = require("../logger");
const defaults = require("../defaults");
const { resolveApiResourceProtocol } = require("../protocol-resolver");
const { readORDExtensions, isPrimaryDataProductService, isValidService, isEventsOnlyService } = require("../common/utils");
const { resolveVisibility, resolveServiceName, flattenEntityGraph } = require("../common/utils");
const { ensureAccessStrategies, getAccessStrategiesFromAuthConfig } = require("../access-strategies");
const {
    DESCRIPTION_PREFIX,
    ORD_RESOURCE_TYPE,
    RESOURCE_VISIBILITY,
    SHORT_DESCRIPTION_PREFIX,
    ORD_API_PROTOCOL,
    MCP_RESOURCE_DEFINITION_TYPE,
    ORD_EXTENSIONS_PREFIX,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    ENTITY_RELATIONSHIP_ANNOTATION,
} = require("../constants");

function _getGroupID(appConfig, srvDefinition) {
    return `${defaults.groupTypeId}:${appConfig.ordNamespace}:${resolveServiceName(appConfig, srvDefinition)}`;
}

function _getExposedEntityTypes(service) {
    const ordIds = new Set(
        Object.values(service.entities ?? {})
            .flatMap((entity) => flattenEntityGraph(entity))
            .flatMap((entity) => {
                const [namespace, name, version = "v1"] = entity[ENTITY_RELATIONSHIP_ANNOTATION]?.split(":") || [];
                const major = (entity[`${ORD_EXTENSIONS_PREFIX}version`] ?? version.substring(1)).split(".")[0];

                return [
                    ...(!entity[ORD_ODM_ENTITY_NAME_ANNOTATION]
                        ? []
                        : [`sap.odm:entityType:${entity[ORD_ODM_ENTITY_NAME_ANNOTATION]}:v1`]),
                    ...(!entity[ENTITY_RELATIONSHIP_ANNOTATION]
                        ? []
                        : [entity["@ORD.Extensions.ordId"] ?? `${namespace}:entityType:${name}:v${major}`]),
                ];
            }),
    );

    return [...ordIds].map((ordId) => ({ ordId: ordId }));
}

/**
 * Pure template function for creating ORD resource definitions.
 * This function does not make assumptions about access strategies - they must be provided explicitly.
 * Access strategies are validated and will fallback to 'open' in non-strict mode if missing.
 *
 * @param {string} resourceType The type of the resource.
 * @param {string} mediaType The media type of the resource.
 * @param {string} ordId The ordId of the resource.
 * @param {string} serviceName The name of the service.
 * @param {string} fileExtension The file extension of the resource.
 * @param {Array<{type: string}>} accessStrategies The array of accessStrategies objects (required, no default)
 * @returns {Object} A resource definition object.
 * @private
 */
function _getResourceDefinition(resourceType, mediaType, ordId, serviceName, fileExtension, accessStrategies) {
    // Validate and ensure access strategies are present
    // In non-strict mode, this will log error and fallback to 'open'
    // In strict mode (cds.env.ord.strictAccessStrategies = true), this will throw
    const validatedStrategies = ensureAccessStrategies(accessStrategies, {
        resourceName: `${serviceName} (${resourceType})`,
    });

    return {
        type: resourceType,
        mediaType: `application/${mediaType}`,
        url: `/ord/v1/${ordId}/${serviceName}.${fileExtension}`,
        accessStrategies: validatedStrategies,
    };
}

/**
 * This is a template function to create API Resource object for API Resource Array.
 * Properties of an API resource can be overwritten by the ORD extensions. Example: visibility.
 * Ensures proper visibility compliance by checking associated EntityTypes.
 * @param {object} srvDefinition The definition of the service
 * @param {object} appConfig - The application configuration.
 * @returns {Array} An array of objects for the API Resources.
 */
const createAPIResourceTemplate = (srvDefinition, appConfig) => {
    const ordExtensions = readORDExtensions(srvDefinition);
    const visibility = resolveVisibility(appConfig, srvDefinition);
    const packageIds = defaults.packages(appConfig)?.map((pkg) => pkg.ordId) || [];
    const packageId = _getPackageID(appConfig.ordNamespace, packageIds, ORD_RESOURCE_TYPE.api, visibility);
    const protocolResults = resolveApiResourceProtocol(srvDefinition);
    const apiResources = [];
    const accessStrategies = getAccessStrategiesFromAuthConfig(appConfig.authConfig.accessStrategies || []);

    // If no protocols were generated, skip this service
    if (protocolResults.length === 0) {
        Logger.info(`No supported protocols for service '${srvDefinition.name}', skipping API resource generation.`);
        return apiResources;
    }

    // Handle version suffix extraction for primary data product services
    let cleanServiceName,
        version,
        semanticVersion,
        extracted = null;
    if (isPrimaryDataProductService(srvDefinition)) {
        extracted = _extractVersionFromServiceName(srvDefinition.name);

        cleanServiceName = resolveServiceName(appConfig, { name: extracted?.cleanName || srvDefinition.name });
        semanticVersion = ordExtensions.version || extracted?.semanticVersion || "1.0.0";
        version = `v${semanticVersion.split(".")[0]}`;
    } else {
        // Non-data product - use current behavior
        cleanServiceName = resolveServiceName(appConfig, srvDefinition);
        semanticVersion = ordExtensions.version || "1.0.0";
        version = `v${semanticVersion.split(".")[0]}`;
    }

    protocolResults.forEach((protocolResult, index) => {
        const { apiProtocol, entryPoints, hasResourceDefinitions } = protocolResult;
        const protocolExtensions = readORDExtensions(srvDefinition, `@protocol('${apiProtocol}').ORD.Extensions.`);
        const ordId =
            protocolExtensions.ordId ||
            ordExtensions.ordId ||
            `${appConfig.ordNamespace}:apiResource:${cleanServiceName}${index === 0 ? "" : `-${apiProtocol}`}:${version}`;

        // Build resource definitions based on protocol
        let resourceDefinitions = [];
        if (hasResourceDefinitions) {
            if (apiProtocol === ORD_API_PROTOCOL.SAP_DATA_SUBSCRIPTION) {
                // Data product services use CSN
                resourceDefinitions = [
                    _getResourceDefinition(
                        "sap-csn-interop-effective-v1",
                        "json",
                        ordId,
                        srvDefinition.name,
                        "csn.json",
                        accessStrategies,
                    ),
                ];
            } else if (apiProtocol === ORD_API_PROTOCOL.REST) {
                // REST only has OpenAPI, no EDMX
                resourceDefinitions = [
                    _getResourceDefinition(
                        "openapi-v3",
                        "json",
                        ordId,
                        srvDefinition.name,
                        "oas3.json",
                        accessStrategies,
                    ),
                ];
            } else if (apiProtocol === ORD_API_PROTOCOL.MCP) {
                resourceDefinitions = [
                    _getResourceDefinition(
                        MCP_RESOURCE_DEFINITION_TYPE,
                        "json",
                        ordId,
                        srvDefinition.name,
                        "mcp.json",
                        accessStrategies,
                    ),
                ];
            } else if (apiProtocol === ORD_API_PROTOCOL.GRAPHQL) {
                // GraphQL only has GraphQL SDL
                resourceDefinitions = [
                    {
                        type: "graphql-sdl",
                        mediaType: "text/plain",
                        url: `/ord/v1/${ordId}/${srvDefinition.name}.graphql`,
                        accessStrategies: ensureAccessStrategies(accessStrategies, {
                            resourceName: `${srvDefinition.name} (graphql-sdl)`,
                        }),
                    },
                ];
            } else if (apiProtocol === ORD_API_PROTOCOL.ODATA_V2) {
                // openapi-v3 is not supported for OData V2, only EDMX
                resourceDefinitions = [
                    _getResourceDefinition("edmx", "xml", ordId, srvDefinition.name, "edmx", accessStrategies),
                ];
            } else {
                // odata-v4 and others have both OpenAPI and EDMX
                resourceDefinitions = [
                    _getResourceDefinition(
                        "openapi-v3",
                        "json",
                        ordId,
                        srvDefinition.name,
                        "oas3.json",
                        accessStrategies,
                    ),
                    _getResourceDefinition("edmx", "xml", ordId, srvDefinition.name, "edmx", accessStrategies),
                ];
            }
        }

        const exposedEntityTypes = _getExposedEntityTypes(srvDefinition);

        let obj = {
            ordId,
            title:
                srvDefinition["@title"] ??
                srvDefinition["@Common.Label"] ??
                srvDefinition["@EndUserText.label"] ??
                srvDefinition.name,
            shortDescription: SHORT_DESCRIPTION_PREFIX + srvDefinition.name,
            description: srvDefinition["@Core.Description"] ?? DESCRIPTION_PREFIX + srvDefinition.name,
            version: semanticVersion,
            lastUpdate: appConfig.lastUpdate,
            visibility,
            partOfPackage: packageId,
            partOfGroups: [_getGroupID(appConfig, srvDefinition)],
            releaseStatus: "active",
            apiProtocol,
            resourceDefinitions,
            entryPoints,
            extensible: {
                supported: "no",
            },
            ...(exposedEntityTypes.length ? { exposedEntityTypes } : []),
            ...ordExtensions,
            ...protocolExtensions,
        };

        // Special handling for data product services
        if (isPrimaryDataProductService(srvDefinition)) {
            obj.direction = "outbound";
            if (extracted) {
                // Overwrite partOfGroups
                obj.partOfGroups = [`${defaults.groupTypeId}:${appConfig.ordNamespace}:${cleanServiceName}`];
            }
        }

        if (obj.visibility !== RESOURCE_VISIBILITY.private) {
            apiResources.push(obj);
        }
    });

    return apiResources;
};

/**
 * Extracts version suffix from service name for data product services.
 * Only accepts pattern: .v<number> (e.g., .v0, .v1, .v2, .v10)
 * Rejects patterns like: .v1.1, .v1.0, .version1, .beta
 *
 * @param {string} serviceName The full service name
 * @returns {Object|null} Object with cleanName, version, and semanticVersion, or null if invalid pattern
 */
function _extractVersionFromServiceName(serviceName) {
    // Only match pattern: .v<number> (where number is 1 or more digits)
    const versionPattern = /\.v(\d+)$/;
    const match = serviceName.match(versionPattern);

    if (!match) {
        return null; // No valid version suffix found
    }

    const versionNumber = parseInt(match[1], 10);

    return {
        cleanName: serviceName.replace(versionPattern, ""),
        semanticVersion: `${versionNumber}.0.0`,
    };
}

function _getPackageID(namespace, packageIds, resourceType, visibility = RESOURCE_VISIBILITY.public) {
    if (!packageIds) return;

    if (resourceType) {
        return (
            packageIds.find((id) => {
                if (visibility === RESOURCE_VISIBILITY.public) {
                    return id.includes(resourceType) && !id.includes("-internal") && !id.includes("-private");
                } else {
                    return id.includes(`${resourceType}-${visibility}`);
                }
            }) || packageIds.find((id) => id.includes(namespace))
        );
    }

    return packageIds.find((id) => id.includes(`-${resourceType}-`)) || packageIds.find((id) => id.includes(namespace));
}

const createAPIResources = (appConfig) => {
    return Object.values(appConfig.csn.definitions)
        .filter((definition) => isValidService(definition) && !isEventsOnlyService(definition))
        .flatMap((service) => createAPIResourceTemplate(service, appConfig));
};

module.exports = {
    createAPIResources,
    createAPIResourceTemplate,
    _getPackageID,
    _getExposedEntityTypes,
};
