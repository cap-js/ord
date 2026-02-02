const cds = require("@sap/cds");
const { hasSAPPolicyLevel } = require("./utils");
const { isMCPPluginReady } = require("./mcpAdapter");
const defaults = require("./defaults");
const _ = require("lodash");
const {
    DATA_PRODUCT_ANNOTATION,
    DATA_PRODUCT_SHORTEN_ANNOTATION,
    DATA_PRODUCT_TYPE,
    DESCRIPTION_PREFIX,
    ENTITY_RELATIONSHIP_ANNOTATION,
    EXTERNAL_DP_ORD_ID_ANNOTATION,
    LEVEL,
    MCP_CUSTOM_TYPE,
    ORD_EXTENSIONS_PREFIX,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    ORD_RESOURCE_TYPE,
    RESOURCE_VISIBILITY,
    ALLOWED_VISIBILITY,
    SUPPORTED_IMPLEMENTATIONSTANDARD_VERSIONS,
    SEM_VERSION_REGEX,
    SHORT_DESCRIPTION_PREFIX,
    CONTENT_MERGE_KEY,
    CDS_ELEMENT_KIND,
} = require("./constants");
const Logger = require("./logger");
const { ensureAccessStrategies } = require("./access-strategies");

function unflatten(flattedObject) {
    let result = {};
    _.keys(flattedObject).forEach(function (key) {
        _.set(result, key, flattedObject[key]);
    });
    return result;
}

function readORDExtensions(model) {
    const ordExtensions = {};
    for (const key in model) {
        if (key.startsWith(ORD_EXTENSIONS_PREFIX)) {
            const ordKey = key.replace(ORD_EXTENSIONS_PREFIX, "");
            ordExtensions[ordKey] = model[key];
        }
    }
    return unflatten(ordExtensions);
}

/**
 * Reads the service definition and returns an array of entryPoint paths.
 *
 * @param {string} srv The service definition name.
 * @param {Object} srvDefinition The service definition object.
 * @returns {Array} An array containing paths and it's kind.
 */
const _generatePaths = (srv, srvDefinition) => {
    const srvObj = { name: srv, definition: srvDefinition };
    const protocols = cds.service.protocols;

    const paths = protocols.endpoints4(srvObj);

    //TODO: check graphql replication in paths object and re-visit logic
    //removing instances of graphql protocol from paths
    for (var index = paths.length - 1; index >= 0; index--) {
        if (paths[index].kind === "graphql") {
            Logger.warn("Graphql protocol is not supported.");
            paths.splice(index, 1);
        }
    }

    //putting OData as default in case of non-supported protocol
    if (paths.length === 0) {
        if (isPrimaryDataProductService(srvDefinition)) {
            // Data product services use REST protocol, not OData
            paths.push({ kind: "rest", path: protocols.path4(srvDefinition) });
        } else {
            srvDefinition["@odata"] = true;
            paths.push({ kind: "odata", path: protocols.path4(srvDefinition) });
        }
    }

    return paths;
};

/**
 * This is a template function to create item of entityTypeMappings array.
 *
 * @param {string} entity The entity definition.
 * @returns {Object} An entry of the entityTypeMappings array.
 */
const createEntityTypeMappingsItemTemplate = (entity) => {
    const results = [];
    if (entity[ORD_ODM_ENTITY_NAME_ANNOTATION]) {
        results.push({
            ordId: `sap.odm:entityType:${entity[ORD_ODM_ENTITY_NAME_ANNOTATION]}:v1`,
            entityName: entity[ORD_ODM_ENTITY_NAME_ANNOTATION],
            isODMMapping: true,
            ...entity,
        });
    }
    if (entity[ENTITY_RELATIONSHIP_ANNOTATION]) {
        const ordIdParts = entity[ENTITY_RELATIONSHIP_ANNOTATION].split(":");
        const namespace = ordIdParts[0];
        const entityName = ordIdParts[1];
        const version = ordIdParts[2] || "v1";
        results.push({
            ordId: `${namespace}:entityType:${entityName}:${version}`,
            entityName,
            ...entity,
        });
    }
    if (results.length === 0) return;
    return results;
};

function _getGroupID(serviceDefinition, groupTypeId = defaults.groupTypeId, appConfig) {
    return `${groupTypeId}:${appConfig.ordNamespace}:${_getGroupNameWithNestedNamespace(serviceDefinition, appConfig)}`;
}

function _getGroupNameWithNestedNamespace({ name }, appConfig) {
    if (!name.startsWith(appConfig.ordNamespace)) {
        return name;
    }
    let sortedName = name.substring(appConfig.ordNamespace.length);
    if (sortedName.startsWith(".")) {
        sortedName = sortedName.substring(1);
    }
    return sortedName;
}

/**
 * This is a function to resolve the title of the service group.
 *
 * @param {string} srv The name of the service.
 * @returns {string} The title of the service group.
 */
function _getTitleFromServiceName(srv) {
    let serviceName = srv.substring(srv.lastIndexOf(".") + 1);
    let index = serviceName.indexOf("Service");
    if (index >= 0) {
        return `${serviceName.substring(0, index)} Service`;
    } else {
        return `${serviceName} Service`;
    }
}

/**
 * This is a function to get the version of the entity,
 * validate it and log if it is not a valid semantical version.
 *
 * @param {object} entity An entity object.
 * @returns Version of the entity with '1.0.0' as fallback value.
 */
function _getEntityVersion(entity) {
    const entityVersion = entity.ordId.split(":").pop();
    const version = entityVersion.replace("v", "") + ".0.0"; // TODO: version can be stated/overwritten by annotation
    if (!SEM_VERSION_REGEX.test(version)) {
        Logger.warn("Entity version", version, "is not a valid semantic version.");
    }
    return version;
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
 * @param {Array} accessStrategies The array of accessStrategies objects (required, no default)
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
 * This is a template function to create group object of a service for groups array in ORD doc.
 *
 * @param {string} serviceName The name of the service.
 * @param {object} serviceDefinition The definition of the service
 * @param {Set} groupIds A set of group ids.
 * @returns {Object} A group object.
 */
const createGroupsTemplateForService = (serviceName, serviceDefinition, appConfig) => {
    const ordExtensions = readORDExtensions(serviceDefinition);

    if (!serviceDefinition) {
        Logger.warn("Unable to find service definition:", serviceName);
        return undefined;
    }

    const visibility = _handleVisibility(ordExtensions, serviceDefinition, appConfig.env?.defaultVisibility);
    if (visibility === RESOURCE_VISIBILITY.private) {
        // If the visibility of the service is private, do not create a group
        Logger.info("Skipping group creation for private service:", serviceName);
        return undefined;
    }

    const groupId = _getGroupID(serviceDefinition, defaults.groupTypeId, appConfig);
    return {
        groupId: groupId,
        groupTypeId: defaults.groupTypeId,
        title: ordExtensions.title ?? _getTitleFromServiceName(serviceName),
    };
};

/**
 * This is a template function to create EntityType object for EntityTypes Array.
 * Ensures correct visibility assignment based on referenced resources.
 *
 * @param { object } appConfig  The configuration object.
 * @param { Array } packageIds The available package identifiers.
 * @param { object } entity The entity definition.
 * @returns { object } An object for the EntityType.
 */
const createEntityTypeTemplate = (appConfig, packageIds, entity) => {
    if (entity.isODMMapping) {
        // ODM mappings are not created as entity types, they are only used in entityTypeMappings
        return [];
    }
    if (hasSAPPolicyLevel(appConfig.policyLevels)) {
        // If SAP policy level is present, don't create entity type, they must be in the central repository
        return [];
    }

    const ordExtensions = readORDExtensions(entity);
    const visibility = ordExtensions.visibility || RESOURCE_VISIBILITY.public;

    if (visibility === RESOURCE_VISIBILITY.private) {
        return [];
    }

    const packageId = _getPackageID(appConfig.ordNamespace, packageIds, ORD_RESOURCE_TYPE.entityType, visibility);

    return {
        ordId: entity.ordId,
        localId: entity.entityName,
        title: entity["@title"] ?? entity["@Common.Label"] ?? entity.entityName,
        shortDescription: SHORT_DESCRIPTION_PREFIX + entity.entityName,
        description: DESCRIPTION_PREFIX + entity.entityName,
        version: _getEntityVersion(entity),
        lastUpdate: appConfig.lastUpdate,
        visibility,
        partOfPackage: packageId,
        releaseStatus: "active",
        level: entity["@ObjectModel.compositionRoot"] || entity["@ODM.root"] ? LEVEL.rootEntity : LEVEL.subEntity,
        extensible: { supported: "no" },
        ...ordExtensions,
    };
};

/**
 * Determines the visibility of a resource based on provided extensions, definition, and default visibility.
 *
 * The function checks for custom visibility values, validates the default visibility,
 * and applies specific rules based on the resource's definition and extensions.
 *
 * @param {Object} ordExtensions - Extensions object containing resource metadata.
 * @param {Object} definition - The resource definition object.
 * @param {string} [defaultVisibility=RESOURCE_VISIBILITY.public] - The default visibility value.
 * @returns {string} The resolved visibility value for the resource.
 */
function _handleVisibility(ordExtensions, definition, defaultVisibility = RESOURCE_VISIBILITY.public) {
    let visibility;
    //check for supported custom visibility value in defaultVisibility variable
    if (!ALLOWED_VISIBILITY.includes(defaultVisibility)) {
        Logger.warn(
            "Default visibility",
            defaultVisibility,
            "is not supported. Using",
            RESOURCE_VISIBILITY.public,
            "as fallback.",
        );
        defaultVisibility = RESOURCE_VISIBILITY.public;
    }
    // Determine visibility
    if (isPrimaryDataProductService(definition)) {
        visibility = RESOURCE_VISIBILITY.internal;
    } else if (ordExtensions.visibility) {
        visibility = ordExtensions.visibility;
    } else if (definition[ORD_EXTENSIONS_PREFIX + "visibility"]) {
        visibility = definition[ORD_EXTENSIONS_PREFIX + "visibility"];
    } else if (SUPPORTED_IMPLEMENTATIONSTANDARD_VERSIONS.includes(ordExtensions.implementationStandard)) {
        // if the implementationStandard is for example sap:ord-document-api:v1, it should be public by default
        visibility = RESOURCE_VISIBILITY.public;
    } else if (ALLOWED_VISIBILITY.includes(defaultVisibility)) {
        // Default visibility from config file
        visibility = defaultVisibility;
    }
    return visibility;
}

/**
 * This is a template function to create API Resource object for API Resource Array.
 * Properties of an API resource can be overwritten by the ORD extensions. Example: visibility.
 * Ensures proper visibility compliance by checking associated EntityTypes.
 * @param {string} serviceName The name of the service.
 * @param {object} serviceDefinition The definition of the service
 * @param {object} appConfig - The application configuration.
 * @param {Array} packageIds - The available package identifiers.
 * @param {Array} accessStrategies The array of accessStrategies objects
 * @returns {Array} An array of objects for the API Resources.
 */
const createAPIResourceTemplate = (serviceName, serviceDefinition, appConfig, packageIds, accessStrategies) => {
    const ordExtensions = readORDExtensions(serviceDefinition);
    const visibility = _handleVisibility(ordExtensions, serviceDefinition, appConfig.env?.defaultVisibility);
    const packageId = _getPackageID(appConfig.ordNamespace, packageIds, ORD_RESOURCE_TYPE.api, visibility);

    const paths = _generatePaths(serviceName, serviceDefinition);
    const apiResources = [];

    // Handle version suffix extraction for primary data product services
    let cleanServiceName,
        version,
        semanticVersion,
        extracted = null;
    if (isPrimaryDataProductService(serviceDefinition)) {
        extracted = _extractVersionFromServiceName(serviceDefinition.name);
        if (extracted) {
            // Create a temporary service definition with the clean name for namespace processing
            const cleanServiceDefinition = { ...serviceDefinition, name: extracted.cleanName };
            cleanServiceName = _getGroupNameWithNestedNamespace(cleanServiceDefinition, appConfig);
            version = extracted.version;
            semanticVersion = extracted.semanticVersion;
        } else {
            // Invalid pattern - use current behavior
            cleanServiceName = _getGroupNameWithNestedNamespace(serviceDefinition, appConfig);
            version = "v1";
            semanticVersion = "1.0.0";
        }
    } else {
        // Non-data product - use current behavior
        cleanServiceName = _getGroupNameWithNestedNamespace(serviceDefinition, appConfig);
        version = "v1";
        semanticVersion = "1.0.0";
    }

    const ordId = `${appConfig.ordNamespace}:apiResource:${cleanServiceName}:${version}`;

    paths.forEach((generatedPath) => {
        let resourceDefinitions = [
            _getResourceDefinition("openapi-v3", "json", ordId, serviceName, "oas3.json", accessStrategies),
        ];

        if (generatedPath.kind !== "rest") {
            //edmx resource definition is not generated in case of 'rest' protocol
            resourceDefinitions.push(
                _getResourceDefinition("edmx", "xml", ordId, serviceName, "edmx", accessStrategies),
            );
        }

        const entityTypeMappings = _getEntityTypeMappings(serviceDefinition);
        const exposedEntityTypes = _getExposedEntityTypes(serviceDefinition);

        let obj = {
            ordId,
            title: serviceDefinition["@title"] ?? serviceDefinition["@Common.Label"] ?? serviceName,
            shortDescription: SHORT_DESCRIPTION_PREFIX + serviceName,
            description: serviceDefinition["@Core.Description"] ?? DESCRIPTION_PREFIX + serviceName,
            version: semanticVersion,
            lastUpdate: appConfig.lastUpdate,
            visibility,
            partOfPackage: packageId,
            partOfGroups: [_getGroupID(serviceDefinition, defaults.groupTypeId, appConfig)],
            releaseStatus: "active",
            apiProtocol: generatedPath.kind === "odata" ? "odata-v4" : generatedPath.kind,
            resourceDefinitions: resourceDefinitions,
            entryPoints: [generatedPath.path],
            extensible: {
                supported: "no",
            },
            ...(entityTypeMappings ? { entityTypeMappings } : {}),
            ...(exposedEntityTypes ? { exposedEntityTypes } : []),
            ...ordExtensions,
        };

        if (isPrimaryDataProductService(serviceDefinition)) {
            obj.apiProtocol = "sap.dp:data-subscription-api:v1";
            obj.direction = "outbound";
            obj.entryPoints = [];
            if (extracted) {
                // Overwrite partOfGroups
                obj.partOfGroups = [`${defaults.groupTypeId}:${appConfig.ordNamespace}:${cleanServiceName}`];
            }
            obj.resourceDefinitions = [
                _getResourceDefinition(
                    "sap-csn-interop-effective-v1",
                    "json",
                    ordId,
                    serviceName,
                    "csn.json",
                    accessStrategies,
                ),
            ];
        }

        if (obj.visibility !== RESOURCE_VISIBILITY.private) {
            apiResources.push(obj);
        }
    });

    return apiResources;
};

/**
 * This is a template function to create Event Resource object for Event Resource Array.
 * There can be only one event resource per service because all events are using the same protocol, they are always Cloud Events.
 * Properties of an event resource can be overwritten by the ORD extensions. Example: visibility.
 * Ensures proper visibility compliance by checking associated EntityTypes.
 *
 * @param {string} serviceName The name of the service.
 * @param {object} serviceDefinition The definition of the service
 * @param {object} appConfig - The application configuration.
 * @param {Array} packageIds - The available package identifiers.
 * @param {Array} accessStrategies The array of accessStrategies objects
 * @returns {Array} An single-item array of objects for the Event Resources.
 */
const createEventResourceTemplate = (serviceName, serviceDefinition, appConfig, packageIds, accessStrategies) => {
    const ordExtensions = readORDExtensions(serviceDefinition);
    const visibility = _handleVisibility(ordExtensions, serviceDefinition, appConfig.env?.defaultVisibility);
    const packageId = _getPackageID(appConfig.ordNamespace, packageIds, ORD_RESOURCE_TYPE.event, visibility);
    const ordId = `${appConfig.ordNamespace}:eventResource:${_getGroupNameWithNestedNamespace(serviceDefinition, appConfig)}:v1`;
    const entityTypeMappings = _getEntityTypeMappings(serviceDefinition);
    const exposedEntityTypes = _getExposedEntityTypes(serviceDefinition);

    let obj = {
        ordId,
        title:
            serviceDefinition["@title"] ??
            serviceDefinition["@Common.Label"] ??
            `ODM ${appConfig.appName.replace(/[^a-zA-Z0-9]/g, "")} Events`,
        shortDescription: `${serviceName} event resource`,
        description:
            serviceDefinition["@description"] ??
            serviceDefinition["@Core.Description"] ??
            "CAP Event resource describing events / messages.",
        version: "1.0.0",
        lastUpdate: appConfig.lastUpdate,
        releaseStatus: "active",
        partOfPackage: packageId,
        partOfGroups: [_getGroupID(serviceDefinition, defaults.groupTypeId, appConfig)],
        visibility,
        resourceDefinitions: [
            _getResourceDefinition("asyncapi-v2", "json", ordId, serviceName, "asyncapi2.json", accessStrategies),
        ],
        extensible: { supported: "no" },
        ...(entityTypeMappings ? { entityTypeMappings } : {}),
        ...(exposedEntityTypes ? { exposedEntityTypes } : []),
        ...ordExtensions,
    };

    return obj.visibility === RESOURCE_VISIBILITY.public || obj.visibility === RESOURCE_VISIBILITY.internal
        ? [obj]
        : [];
};

function isPrimaryDataProductService(serviceDefinition) {
    return (
        serviceDefinition[DATA_PRODUCT_ANNOTATION] === DATA_PRODUCT_TYPE.primary ||
        !!serviceDefinition[DATA_PRODUCT_SHORTEN_ANNOTATION]
    );
}

function _getEntityTypeMappings(definitionObj) {
    if (!definitionObj.entities) {
        return;
    }
    const entities = Object.values(definitionObj.entities).flatMap((entity) => {
        const entityData = _flattenEntityGraph(entity)
            .flatMap(createEntityTypeMappingsItemTemplate) // now returns arrays
            .filter(Boolean);
        return _.uniqBy(entityData, CONTENT_MERGE_KEY);
    });
    const entityTypeTargets = _.uniqBy(entities, CONTENT_MERGE_KEY)
        .filter((entity) => entity !== undefined)
        .map(({ ordId }) => ({
            ordId,
        }));
    if (entityTypeTargets.length > 0) {
        return [{ entityTypeTargets }];
    } else {
        return;
    }
}

function _getExposedEntityTypes(definitionObj) {
    if (!definitionObj.entities) {
        return;
    }
    const entities = Object.values(definitionObj.entities).flatMap((entity) => {
        const entityData = _flattenEntityGraph(entity).flatMap(createEntityTypeMappingsItemTemplate).filter(Boolean);
        return _.uniqBy(entityData, CONTENT_MERGE_KEY);
    });
    const exposedEntityTypes = _.uniqBy(entities, CONTENT_MERGE_KEY)
        .filter((entity) => entity !== undefined)
        .map(({ ordId }) => ({
            ordId,
        }));
    if (exposedEntityTypes.length > 0) {
        return exposedEntityTypes;
    } else {
        return;
    }
}

function _flattenEntityGraph(currentEntity, processedEntities = []) {
    if (!currentEntity.associations) {
        return [currentEntity];
    }
    const entityAssociationTargets = Object.values(currentEntity.associations).map((association) => ({
        target: association.target,
        entity: association._target,
    }));

    const assertionsTodo = [];
    entityAssociationTargets.forEach(({ target, entity }) => {
        if (processedEntities.includes(target)) {
            return;
        }
        assertionsTodo.push(entity);

        /*
        the next line operates on heap memory so that the same entity is not processed again
        heap memory is used so that the check is the same in:
        a > b > c > b scenario (runs first)
        a > d > c > ... scenario (runs later and does not process c again)
        */
        processedEntities.push(target);
    });

    return [currentEntity, ...assertionsTodo.flatMap((entity) => _flattenEntityGraph(entity, processedEntities))];
}

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
        version: `v${versionNumber}`,
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

/**
 * Helper function to create a single MCP API resource.
 *
 * @param {object} metadata - The MCP metadata object.
 * @param {object} appConfig - The application configuration.
 * @param {Array} packageIds - The available package identifiers.
 * @param {Array} accessStrategies - The array of accessStrategies objects.
 * @returns {Object} An MCP API resource object.
 */
function createSingleMCPResource(metadata, appConfig, packageIds, accessStrategies) {
    const visibility = metadata?.visibility || RESOURCE_VISIBILITY.public;

    // Generate ordId based on visibility
    let resourceId;
    if (visibility === RESOURCE_VISIBILITY.public) {
        resourceId = "mcp-server"; // Default public resource
    } else {
        resourceId = `mcp-server-${visibility}`; // mcp-server-internal, mcp-server-private
    }

    const ordId = `${appConfig.ordNamespace}:apiResource:${resourceId}:v1`;

    // Use metadata with proper fallbacks
    const title = metadata?.title || `MCP Server for ${appConfig.appName}`;
    const shortDescription =
        metadata?.shortDescription || `This is the MCP server to interact with the ${appConfig.appName}`;
    const description = metadata?.description || `This is the MCP server to interact with the ${appConfig.appName}`;
    const version = metadata?.version || "1.0.0";

    // Handle entryPoints: convert string to array, with fallback
    const entryPoints = metadata?.entryPoints ? metadata.entryPoints : ["/rest/mcp/streaming"];

    const packageId = _getPackageID(appConfig.ordNamespace, packageIds, ORD_RESOURCE_TYPE.api, visibility);
    // Fallback: ensure partOfPackage never undefined to satisfy generic apiResources tests
    const effectivePackageId = packageId || `${appConfig.ordNamespace}:package:${visibility}:v1`;

    return {
        ordId,
        title,
        shortDescription,
        description,
        version,
        lastUpdate: appConfig.lastUpdate,
        visibility,
        partOfPackage: effectivePackageId,
        releaseStatus: "active",
        apiProtocol: "mcp",
        resourceDefinitions: [
            {
                type: "custom",
                customType: MCP_CUSTOM_TYPE,
                mediaType: "application/json",
                url: `/ord/v1/${ordId}/mcp-server-definition.mcp.json`,
                accessStrategies,
            },
        ],
        entryPoints,
        extensible: { supported: "no" },
    };
}

/**
 * This is a template function to create MCP API Resource object(s).
 *
 * The generated MCP API resource(s) can be customized via the generic overwrite mechanism
 * using custom.ord.json. Properties like visibility, title, version, entryPoints, etc.
 * can be overridden by matching the ordId pattern.
 *
 * Metadata values are sourced from the MCP plugin's generateORDMetadata function when available,
 * which reads from cds.env.mcp configuration. This allows users to customize MCP metadata via
 * package.json or .cdsrc.json files.
 *
 * @param {object} appConfig - The application configuration.
 * @param {Array} packageIds - The available package identifiers.
 * @param {Array} accessStrategies The array of accessStrategies objects
 * @returns {Object|Array} An MCP API resource object or array of objects.
 */
const createMCPAPIResourceTemplate = (appConfig, packageIds, accessStrategies) => {
    // Get ORD metadata from MCP plugin if available
    let ordMetadata = null;
    // Use comprehensive check for MCP plugin readiness
    const shouldAddMCP = isMCPPluginReady();
    if (shouldAddMCP) {
        try {
            const { generateORDMetadata } = require("@btp-ai/mcp-plugin/lib/utils/metadata");
            ordMetadata = generateORDMetadata();
        } catch (error) {
            Logger.warn("Failed to generate MCP ORD metadata:", error.message);
        }
    }

    // Handle both array and single object responses from MCP plugin
    if (Array.isArray(ordMetadata)) {
        return ordMetadata.map((metadata) =>
            createSingleMCPResource(metadata, appConfig, packageIds, accessStrategies),
        );
    } else {
        return createSingleMCPResource(ordMetadata || {}, appConfig, packageIds, accessStrategies);
    }
};

function _propagateORDVisibility(model) {
    for (const [name, def] of Object.entries(model.definitions)) {
        if (def.kind === CDS_ELEMENT_KIND.service && def[ORD_EXTENSIONS_PREFIX + "visibility"]) {
            const serviceName = name;
            const serviceVisibility = def[ORD_EXTENSIONS_PREFIX + "visibility"];
            for (const serviceChildrenDef of model.definitions) {
                if (
                    serviceChildrenDef.name.startsWith(serviceName + ".") &&
                    !serviceChildrenDef[ORD_EXTENSIONS_PREFIX + "visibility"]
                ) {
                    serviceChildrenDef[ORD_EXTENSIONS_PREFIX + "visibility"] = serviceVisibility;
                }
            }
        }
    }

    return model;
}

module.exports = {
    createEntityTypeTemplate,
    createEntityTypeMappingsItemTemplate,
    createGroupsTemplateForService,
    createAPIResourceTemplate,
    createEventResourceTemplate,
    createMCPAPIResourceTemplate,
    readORDExtensions,
    _getPackageID,
    _getEntityTypeMappings,
    _getExposedEntityTypes,
    _propagateORDVisibility,
    _handleVisibility,
    isPrimaryDataProductService,
};
