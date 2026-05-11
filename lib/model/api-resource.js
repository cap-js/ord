const _ = require("lodash");
const defaults = require("../defaults");
const { ensureAccessStrategies } = require("../access-strategies");
const {
    CONTENT_MERGE_KEY,
    DESCRIPTION_PREFIX,
    MCP_RESOURCE_DEFINITION_TYPE,
    ORD_API_PROTOCOL,
    ORD_RESOURCE_TYPE,
    RESOURCE_VISIBILITY,
    SHORT_DESCRIPTION_PREFIX,
} = require("../constants");
const { determineVisibility, isPrimaryDataProductService } = require("./visibility");
const { stripNamespacePrefix, buildGroupId, findPackageId } = require("./naming");

function createApiResources(service, config, packageIds, accessStrategies) {
    const { extensions, definition } = service;
    const visibility = determineVisibility(extensions, definition, config);

    if (visibility === RESOURCE_VISIBILITY.private) return [];

    const packageId = findPackageId(config.ordNamespace, packageIds, ORD_RESOURCE_TYPE.api, visibility);
    const { localName, version, semanticVersion, versionInfo } = extractNameAndVersion(service, config);

    return service.protocols.map((protocol, index) => {
        const { apiProtocol, entryPoints, hasResourceDefinitions } = protocol;

        const defaultOrdId =
            index === 0
                ? `${config.ordNamespace}:apiResource:${localName}:${version}`
                : `${config.ordNamespace}:apiResource:${localName}-${apiProtocol}:${version}`;

        const resource = mergeResourceProperties(service, config, {
            packageId,
            ordId: defaultOrdId,
            version: semanticVersion,
            fallbackTitle: service.name,
            protocolFields: { apiProtocol, entryPoints },
        });

        if (isPrimaryDataProductService(definition)) {
            resource.direction = "outbound";
            if (versionInfo) {
                resource.partOfGroups = [`${defaults.groupTypeId}:${config.ordNamespace}:${localName}`];
            }
        }

        if (!resource.resourceDefinitions && hasResourceDefinitions) {
            resource.resourceDefinitions = buildResourceDefinitions(
                resource.ordId,
                apiProtocol,
                service.name,
                accessStrategies,
            );
        }

        return resource;
    });
}

function mergeResourceProperties(
    service,
    config,
    { packageId, ordId, version, fallbackTitle, fallbackShortDescription, fallbackDescription, protocolFields = {} },
) {
    const { extensions, definition } = service;
    const exposedEntityTypes = collectExposedEntityTypes(definition);

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
        visibility: determineVisibility(extensions, definition, config),
        partOfPackage: packageId,
        partOfGroups: [buildGroupId(service, config)],
        releaseStatus: "active",
        extensible: { supported: "no" },
        ...(exposedEntityTypes ? { exposedEntityTypes } : []),
        ...protocolFields,
        ...extensions,
    };
}

function buildResourceDefinitions(ordId, apiProtocol, serviceName, accessStrategies) {
    if (apiProtocol === ORD_API_PROTOCOL.SAP_DATA_SUBSCRIPTION) {
        return [
            buildSingleDefinition(
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
        return [buildSingleDefinition("openapi-v3", "json", ordId, serviceName, "oas3.json", accessStrategies)];
    }
    if (apiProtocol === ORD_API_PROTOCOL.MCP) {
        return [
            buildSingleDefinition(
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
        return [buildSingleDefinition("edmx", "xml", ordId, serviceName, "edmx", accessStrategies)];
    }
    return [
        buildSingleDefinition("openapi-v3", "json", ordId, serviceName, "oas3.json", accessStrategies),
        buildSingleDefinition("edmx", "xml", ordId, serviceName, "edmx", accessStrategies),
    ];
}

function buildSingleDefinition(resourceType, mediaType, ordId, serviceName, fileExtension, accessStrategies) {
    return {
        type: resourceType,
        mediaType: `application/${mediaType}`,
        url: `/ord/v1/${ordId}/${serviceName}.${fileExtension}`,
        accessStrategies: ensureAccessStrategies(accessStrategies, {
            resourceName: `${serviceName} (${resourceType})`,
        }),
    };
}

function extractNameAndVersion(service, config) {
    const { definition } = service;
    let localName,
        version,
        semanticVersion,
        versionInfo = null;

    if (isPrimaryDataProductService(definition)) {
        versionInfo = extractVersionSuffix(definition.name);
        if (versionInfo) {
            const cleanDef = { ...definition, name: versionInfo.baseName };
            localName = stripNamespacePrefix({ ...service, definition: cleanDef }, config);
            version = versionInfo.version;
            semanticVersion = versionInfo.semanticVersion;
        } else {
            localName = stripNamespacePrefix(service, config);
            version = "v1";
            semanticVersion = "1.0.0";
        }
    } else {
        localName = stripNamespacePrefix(service, config);
        version = "v1";
        semanticVersion = "1.0.0";
    }

    return { localName, version, semanticVersion, versionInfo };
}

function extractVersionSuffix(serviceName) {
    const versionPattern = /\.v(\d+)$/;
    const match = serviceName.match(versionPattern);
    if (!match) return null;

    const versionNumber = parseInt(match[1], 10);
    return {
        baseName: serviceName.replace(versionPattern, ""),
        version: `v${versionNumber}`,
        semanticVersion: `${versionNumber}.0.0`,
    };
}

function collectExposedEntityTypes(definitionObj) {
    if (!definitionObj.entities) return;
    const { createEntityTypeMappingsItemTemplate } = require("../templates");
    const entities = Object.values(definitionObj.entities).flatMap((entity) => {
        const entityData = collectReachableEntities(entity)
            .flatMap(createEntityTypeMappingsItemTemplate)
            .filter(Boolean);
        return _.uniqBy(entityData, CONTENT_MERGE_KEY);
    });
    const exposedEntityTypes = _.uniqBy(entities, CONTENT_MERGE_KEY)
        .filter((entity) => entity !== undefined)
        .map(({ ordId }) => ({ ordId }));
    if (exposedEntityTypes.length > 0) return exposedEntityTypes;
}

function collectReachableEntities(currentEntity, visited = []) {
    if (!currentEntity.associations) return [currentEntity];
    const associationTargets = Object.values(currentEntity.associations).map((association) => ({
        target: association.target,
        entity: association._target,
    }));

    const entitiesToVisit = [];
    associationTargets.forEach(({ target, entity }) => {
        if (visited.includes(target)) return;
        entitiesToVisit.push(entity);
        visited.push(target);
    });

    return [currentEntity, ...entitiesToVisit.flatMap((entity) => collectReachableEntities(entity, visited))];
}

module.exports = { createApiResources, mergeResourceProperties, buildResourceDefinitions };
