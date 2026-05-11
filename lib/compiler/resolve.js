const _ = require("lodash");
const cds = require("@sap/cds");
const defaults = require("../defaults");
const Logger = require("../logger");
const { ensureAccessStrategies } = require("../access-strategies");
const { createAuthConfig } = require("../auth/authentication");
const { createIntegrationDependency } = require("../integration-dependency");
const {
    ALLOWED_VISIBILITY,
    CONTENT_MERGE_KEY,
    DATA_PRODUCT_ANNOTATION,
    DATA_PRODUCT_SIMPLE_ANNOTATION,
    DATA_PRODUCT_TYPE,
    DESCRIPTION_PREFIX,
    MCP_RESOURCE_DEFINITION_TYPE,
    ORD_API_PROTOCOL,
    ORD_RESOURCE_TYPE,
    RESOURCE_VISIBILITY,
    SHORT_DESCRIPTION_PREFIX,
    SUPPORTED_IMPLEMENTATIONSTANDARD_VERSIONS,
} = require("../constants");

function resolve(ir) {
    const { config, services, entities, externalServices } = ir;

    const authConfig = createAuthConfig();
    if (authConfig.error) {
        throw new Error(`Authentication configuration error: ${authConfig.error}`);
    }
    const accessStrategies = authConfig.accessStrategies;

    config.policyLevels =
        config.env?.policyLevels || (config.env?.policyLevel && [config.env.policyLevel]) || defaults.policyLevels;

    const products = _resolveProducts(config);
    const packages = _resolvePackages(config, products);
    const packageIds = packages.map((p) => p.ordId);
    const consumptionBundles = _resolveConsumptionBundles(config);

    const groups = services.map((svc) => _resolveGroup(svc, config)).filter(Boolean);

    const apiResources = services
        .filter((svc) => svc.protocols.length > 0)
        .flatMap((svc) => _resolveApiResources(svc, config, packageIds, accessStrategies));

    const eventResources = services
        .filter((svc) => svc.hasEvents)
        .flatMap((svc) => _resolveEventResource(svc, config, packageIds, accessStrategies));

    const entityTypes = _resolveEntityTypes(entities, config, packageIds);

    const integrationDependencies =
        externalServices.length > 0
            ? [
                  createIntegrationDependency(
                      externalServices,
                      { ...config, ordNamespace: config.ordNamespace, env: config.env },
                      packageIds,
                  ),
              ]
            : [];

    ir.resolved = {
        products,
        packages,
        consumptionBundles,
        groups,
        apiResources,
        eventResources,
        entityTypes,
        integrationDependencies,
    };
    return ir;
}

// ─── Base Resource (shared by apiResource + eventResource) ───

function _createBaseResource(
    service,
    config,
    { packageId, ordId, version, fallbackTitle, fallbackShortDescription, fallbackDescription, fields = {} },
) {
    const { extensions, definition } = service;
    const exposedEntityTypes = _getExposedEntityTypes(definition);

    return {
        ordId,
        title: definition["@title"] ?? definition["@Common.Label"] ?? fallbackTitle,
        shortDescription: fallbackShortDescription || SHORT_DESCRIPTION_PREFIX + service.name,
        description:
            definition["@description"] ??
            definition["@Core.Description"] ??
            (fallbackDescription || DESCRIPTION_PREFIX + service.name),
        version,
        lastUpdate: config.lastUpdate,
        visibility: _resolveVisibility(extensions, definition, config),
        partOfPackage: packageId,
        partOfGroups: [_getGroupId(service, config)],
        releaseStatus: "active",
        extensible: { supported: "no" },
        ...(exposedEntityTypes ? { exposedEntityTypes } : []),
        ...fields,
        ...extensions,
    };
}

// ─── API Resources ───

function _resolveApiResources(service, config, packageIds, accessStrategies) {
    const { extensions, definition } = service;
    const visibility = _resolveVisibility(extensions, definition, config);

    if (visibility === RESOURCE_VISIBILITY.private) return [];

    const packageId = _getPackageId(config.ordNamespace, packageIds, ORD_RESOURCE_TYPE.api, visibility);
    const { cleanServiceName, version, semanticVersion, extracted } = _resolveNameAndVersion(service, config);

    return service.protocols.map((protocol, index) => {
        const { apiProtocol, entryPoints, hasResourceDefinitions } = protocol;

        const defaultOrdId =
            index === 0
                ? `${config.ordNamespace}:apiResource:${cleanServiceName}:${version}`
                : `${config.ordNamespace}:apiResource:${cleanServiceName}-${apiProtocol}:${version}`;

        // SETTLE
        const resource = _createBaseResource(service, config, {
            packageId,
            ordId: defaultOrdId,
            version: semanticVersion,
            fallbackTitle: service.name,
            fields: { apiProtocol, entryPoints },
        });

        // Data product special handling
        if (_isPrimaryDataProductService(definition)) {
            resource.direction = "outbound";
            if (extracted) {
                resource.partOfGroups = [`${defaults.groupTypeId}:${config.ordNamespace}:${cleanServiceName}`];
            }
        }

        // DERIVE
        if (!resource.resourceDefinitions && hasResourceDefinitions) {
            resource.resourceDefinitions = _buildResourceDefinitions(
                resource.ordId,
                apiProtocol,
                service.name,
                accessStrategies,
            );
        }

        return resource;
    });
}

// ─── Event Resources ───

function _resolveEventResource(service, config, packageIds, accessStrategies) {
    const { extensions, definition } = service;
    const visibility = _resolveVisibility(extensions, definition, config);

    if (visibility === RESOURCE_VISIBILITY.private) return [];
    if (visibility !== RESOURCE_VISIBILITY.public && visibility !== RESOURCE_VISIBILITY.internal) return [];

    const packageId = _getPackageId(config.ordNamespace, packageIds, ORD_RESOURCE_TYPE.event, visibility);
    const ordId = `${config.ordNamespace}:eventResource:${_getGroupName(service, config)}:v1`;

    // SETTLE
    const resource = _createBaseResource(service, config, {
        packageId,
        ordId,
        version: "1.0.0",
        fallbackTitle: `ODM ${config.appName.replace(/[^a-zA-Z0-9]/g, "")} Events`,
        fallbackShortDescription: `${service.name} event resource`,
        fallbackDescription: "CAP Event resource describing events / messages.",
    });

    // DERIVE
    if (!resource.resourceDefinitions) {
        resource.resourceDefinitions = [
            _buildSingleResourceDefinition(
                "asyncapi-v2",
                "json",
                resource.ordId,
                service.name,
                "asyncapi2.json",
                accessStrategies,
            ),
        ];
    }

    return [resource];
}

// ─── Groups ───

function _resolveGroup(service, config) {
    const { extensions, definition } = service;
    const visibility = _resolveVisibility(extensions, definition, config);
    if (visibility === RESOURCE_VISIBILITY.private) return null;

    const groupId = _getGroupId(service, config);
    return {
        groupId,
        groupTypeId: defaults.groupTypeId,
        title: extensions.title ?? _getTitleFromServiceName(service.name),
    };
}

// ─── Entity Types ───

function _resolveEntityTypes(entities, config, packageIds) {
    if (!entities?.length) return [];
    if (_hasSAPPolicyLevel(config.policyLevels)) return [];

    return entities.flatMap((entity) => {
        if (entity.isODMMapping) return [];

        const extensions = _readEntityExtensions(entity);
        const visibility = extensions.visibility || RESOURCE_VISIBILITY.public;
        if (visibility === RESOURCE_VISIBILITY.private) return [];

        const packageId = _getPackageId(config.ordNamespace, packageIds, ORD_RESOURCE_TYPE.entityType, visibility);
        const entityVersion = entity.ordId.split(":").pop();
        const version = entityVersion.replace("v", "") + ".0.0";

        return {
            ordId: entity.ordId,
            localId: entity.entityName,
            title: entity["@title"] ?? entity["@Common.Label"] ?? entity.entityName,
            shortDescription: SHORT_DESCRIPTION_PREFIX + entity.entityName,
            description: DESCRIPTION_PREFIX + entity.entityName,
            version,
            lastUpdate: config.lastUpdate,
            visibility,
            partOfPackage: packageId,
            releaseStatus: "active",
            level: entity["@ObjectModel.compositionRoot"] || entity["@ODM.root"] ? "root-entity" : "sub-entity",
            extensible: { supported: "no" },
            ...extensions,
        };
    });
}

// ─── Products ───

function _resolveProducts(config) {
    const productsObj = defaults.products(config.packageName);
    if (config.env?.products) {
        const customProducts = config.env.products[0];
        if (customProducts?.ordId?.toLowerCase().startsWith("sap")) {
            Logger.error("Detected sap product ordId, which should not be defined for custom products.");
        } else {
            _.assign(productsObj[0], customProducts);
        }
    }
    config.products = productsObj;
    return productsObj;
}

// ─── Packages ───

function _resolvePackages(config, products) {
    const appConfig = {
        ...config,
        policyLevels: config.policyLevels,
        hasSAPPolicyLevel: _hasSAPPolicyLevel(config.policyLevels),
        existingProductORDId: config.env?.existingProductORDId,
        products,
    };
    return defaults.packages(appConfig, products);
}

// ─── Consumption Bundles ───

function _resolveConsumptionBundles(config) {
    return config.env?.consumptionBundles || defaults.consumptionBundles(config);
}

// ─── Resource Definitions (DERIVE phase) ───

function _buildResourceDefinitions(ordId, apiProtocol, serviceName, accessStrategies) {
    if (apiProtocol === ORD_API_PROTOCOL.SAP_DATA_SUBSCRIPTION) {
        return [
            _buildSingleResourceDefinition(
                "sap-csn-interop-effective-v1",
                "json",
                ordId,
                serviceName,
                "csn.json",
                accessStrategies,
            ),
        ];
    }
    if (apiProtocol === ORD_API_PROTOCOL.REST) {
        return [
            _buildSingleResourceDefinition("openapi-v3", "json", ordId, serviceName, "oas3.json", accessStrategies),
        ];
    }
    if (apiProtocol === ORD_API_PROTOCOL.MCP) {
        return [
            _buildSingleResourceDefinition(
                MCP_RESOURCE_DEFINITION_TYPE,
                "json",
                ordId,
                serviceName,
                "mcp.json",
                accessStrategies,
            ),
        ];
    }
    if (apiProtocol === ORD_API_PROTOCOL.GRAPHQL) {
        return [
            {
                type: "graphql-sdl",
                mediaType: "text/plain",
                url: `/ord/v1/${ordId}/${serviceName}.graphql`,
                accessStrategies: ensureAccessStrategies(accessStrategies, {
                    resourceName: `${serviceName} (graphql-sdl)`,
                }),
            },
        ];
    }
    if (apiProtocol === ORD_API_PROTOCOL.ODATA_V2) {
        return [_buildSingleResourceDefinition("edmx", "xml", ordId, serviceName, "edmx", accessStrategies)];
    }
    // OData V4 and others: both OpenAPI and EDMX
    return [
        _buildSingleResourceDefinition("openapi-v3", "json", ordId, serviceName, "oas3.json", accessStrategies),
        _buildSingleResourceDefinition("edmx", "xml", ordId, serviceName, "edmx", accessStrategies),
    ];
}

function _buildSingleResourceDefinition(resourceType, mediaType, ordId, serviceName, fileExtension, accessStrategies) {
    return {
        type: resourceType,
        mediaType: `application/${mediaType}`,
        url: `/ord/v1/${ordId}/${serviceName}.${fileExtension}`,
        accessStrategies: ensureAccessStrategies(accessStrategies, {
            resourceName: `${serviceName} (${resourceType})`,
        }),
    };
}

// ─── Helpers ───

function _resolveVisibility(extensions, definition, config) {
    let defaultVisibility = config.env?.defaultVisibility || RESOURCE_VISIBILITY.public;

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

    if (_isPrimaryDataProductService(definition)) return RESOURCE_VISIBILITY.internal;
    if (extensions.visibility) return extensions.visibility;
    if (definition["@ORD.Extensions.visibility"]) return definition["@ORD.Extensions.visibility"];
    if (SUPPORTED_IMPLEMENTATIONSTANDARD_VERSIONS.includes(extensions.implementationStandard))
        return RESOURCE_VISIBILITY.public;
    return defaultVisibility;
}

function _resolveNameAndVersion(service, config) {
    const { definition } = service;
    let cleanServiceName,
        version,
        semanticVersion,
        extracted = null;

    if (_isPrimaryDataProductService(definition)) {
        extracted = _extractVersionFromServiceName(definition.name);
        if (extracted) {
            const cleanDef = { ...definition, name: extracted.cleanName };
            cleanServiceName = _getGroupName({ ...service, definition: cleanDef }, config);
            version = extracted.version;
            semanticVersion = extracted.semanticVersion;
        } else {
            cleanServiceName = _getGroupName(service, config);
            version = "v1";
            semanticVersion = "1.0.0";
        }
    } else {
        cleanServiceName = _getGroupName(service, config);
        version = "v1";
        semanticVersion = "1.0.0";
    }

    return { cleanServiceName, version, semanticVersion, extracted };
}

function _extractVersionFromServiceName(serviceName) {
    const versionPattern = /\.v(\d+)$/;
    const match = serviceName.match(versionPattern);
    if (!match) return null;

    const versionNumber = parseInt(match[1], 10);
    return {
        cleanName: serviceName.replace(versionPattern, ""),
        version: `v${versionNumber}`,
        semanticVersion: `${versionNumber}.0.0`,
    };
}

function _getGroupName(service, config) {
    const name = service.definition.name;
    let sortedName = name;
    if (config.internalNamespace && _startsWithNamespace(name, config.internalNamespace)) {
        sortedName = name.substring(config.internalNamespace.length);
    } else if (_startsWithNamespace(name, config.ordNamespace)) {
        sortedName = name.substring(config.ordNamespace.length);
    }
    if (sortedName.startsWith(".")) sortedName = sortedName.substring(1);
    return sortedName;
}

function _startsWithNamespace(name, namespace) {
    if (!name.startsWith(namespace)) return false;
    const rest = name.substring(namespace.length);
    return rest === "" || rest.startsWith(".");
}

function _getGroupId(service, config) {
    return `${defaults.groupTypeId}:${config.ordNamespace}:${_getGroupName(service, config)}`;
}

function _getTitleFromServiceName(name) {
    let serviceName = name.substring(name.lastIndexOf(".") + 1);
    let index = serviceName.indexOf("Service");
    if (index >= 0) return `${serviceName.substring(0, index)} Service`;
    return `${serviceName} Service`;
}

function _getPackageId(namespace, packageIds, resourceType, visibility = RESOURCE_VISIBILITY.public) {
    if (!packageIds) return;
    if (resourceType) {
        return (
            packageIds.find((id) => {
                if (visibility === RESOURCE_VISIBILITY.public) {
                    return id.includes(resourceType) && !id.includes("-internal") && !id.includes("-private");
                }
                return id.includes(`${resourceType}-${visibility}`);
            }) || packageIds.find((id) => id.includes(namespace))
        );
    }
    return packageIds.find((id) => id.includes(`-${resourceType}-`)) || packageIds.find((id) => id.includes(namespace));
}

function _isPrimaryDataProductService(definition) {
    return (
        definition[DATA_PRODUCT_ANNOTATION] === DATA_PRODUCT_TYPE.primary ||
        !!definition[DATA_PRODUCT_SIMPLE_ANNOTATION]
    );
}

function _getExposedEntityTypes(definitionObj) {
    if (!definitionObj.entities) return;
    const { createEntityTypeMappingsItemTemplate } = require("../templates");
    const entities = Object.values(definitionObj.entities).flatMap((entity) => {
        const entityData = _flattenEntityGraph(entity).flatMap(createEntityTypeMappingsItemTemplate).filter(Boolean);
        return _.uniqBy(entityData, CONTENT_MERGE_KEY);
    });
    const exposedEntityTypes = _.uniqBy(entities, CONTENT_MERGE_KEY)
        .filter((entity) => entity !== undefined)
        .map(({ ordId }) => ({ ordId }));
    if (exposedEntityTypes.length > 0) return exposedEntityTypes;
}

function _flattenEntityGraph(currentEntity, processedEntities = []) {
    if (!currentEntity.associations) return [currentEntity];
    const entityAssociationTargets = Object.values(currentEntity.associations).map((association) => ({
        target: association.target,
        entity: association._target,
    }));

    const assertionsTodo = [];
    entityAssociationTargets.forEach(({ target, entity }) => {
        if (processedEntities.includes(target)) return;
        assertionsTodo.push(entity);
        processedEntities.push(target);
    });

    return [currentEntity, ...assertionsTodo.flatMap((entity) => _flattenEntityGraph(entity, processedEntities))];
}

function _readEntityExtensions(entity) {
    const { ORD_EXTENSIONS_PREFIX } = require("../constants");
    const ordExtensions = {};
    for (const key in entity) {
        if (key.startsWith(ORD_EXTENSIONS_PREFIX)) {
            ordExtensions[key.replace(ORD_EXTENSIONS_PREFIX, "")] = entity[key];
        }
    }
    return ordExtensions;
}

function _hasSAPPolicyLevel(policyLevels) {
    return policyLevels.some((policyLevel) => policyLevel.split(":")[0].toLowerCase() === "sap");
}

module.exports = { resolve };
