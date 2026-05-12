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
            visibility,
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
    {
        packageId,
        ordId: defaultOrdId,
        version: defaultVersion,
        visibility: passedVisibility,
        fallbackTitle,
        fallbackShortDescription,
        fallbackDescription,
        protocolFields = {},
    },
) {
    const { extensions, definition } = service;

    // Step 1: Resolve each field to its final value (extensions override defaults)
    const ordId = extensions.ordId ?? defaultOrdId;
    const title = extensions.title ?? definition["@title"] ?? definition["@Common.Label"] ?? fallbackTitle;
    const shortDescription =
        extensions.shortDescription ?? (fallbackShortDescription || SHORT_DESCRIPTION_PREFIX + service.name);
    const description =
        extensions.description ??
        definition["@description"] ??
        definition["@Core.Description"] ??
        (fallbackDescription || DESCRIPTION_PREFIX + service.name);
    const version = extensions.version ?? defaultVersion;
    const visibility = extensions.visibility ?? passedVisibility ?? determineVisibility(extensions, definition, config);
    const partOfPackage = extensions.partOfPackage ?? packageId;
    const partOfGroups = extensions.partOfGroups ?? [buildGroupId(service, config)];
    const releaseStatus = extensions.releaseStatus ?? "active";
    const extensible = extensions.extensible ?? { supported: "no" };
    const exposedEntityTypes = extensions.exposedEntityTypes ?? deriveExposedEntityTypes(definition);
    const resourceDefinitions = extensions.resourceDefinitions;

    // Step 2: Assemble the resource from finalized fields
    const resource = {
        ordId,
        title,
        shortDescription,
        description,
        version,
        lastUpdate: config.lastUpdate,
        visibility,
        partOfPackage,
        partOfGroups,
        releaseStatus,
        extensible,
        ...(exposedEntityTypes && { exposedEntityTypes }),
        ...(resourceDefinitions && { resourceDefinitions }),
        ...protocolFields,
    };

    // Pass through any remaining extension properties not explicitly handled above
    const handledKeys = new Set([
        "ordId",
        "title",
        "shortDescription",
        "description",
        "version",
        "visibility",
        "partOfPackage",
        "partOfGroups",
        "releaseStatus",
        "extensible",
        "exposedEntityTypes",
        "resourceDefinitions",
    ]);
    for (const [key, value] of Object.entries(extensions)) {
        if (!handledKeys.has(key)) {
            resource[key] = value;
        }
    }

    return resource;
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

function buildSingleDefinition(definitionType, mediaSubtype, ordId, serviceName, urlSuffix, accessStrategies) {
    return {
        type: definitionType,
        mediaType: `application/${mediaSubtype}`,
        url: `/ord/v1/${ordId}/${serviceName}.${urlSuffix}`,
        accessStrategies: ensureAccessStrategies(accessStrategies, {
            resourceName: `${serviceName} (${definitionType})`,
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
        versionInfo = parseVersionedServiceName(definition.name);
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

function parseVersionedServiceName(serviceName) {
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

function deriveExposedEntityTypes(serviceDefinition) {
    if (!serviceDefinition.entities) return;
    const { createEntityTypeMappingsItemTemplate } = require("../templates");
    const entities = Object.values(serviceDefinition.entities).flatMap((entity) => {
        const entityData = traverseAssociationGraph(entity)
            .flatMap(createEntityTypeMappingsItemTemplate)
            .filter(Boolean);
        return _.uniqBy(entityData, CONTENT_MERGE_KEY);
    });
    const exposedEntityTypes = _.uniqBy(entities, CONTENT_MERGE_KEY)
        .filter((entity) => entity !== undefined)
        .map(({ ordId }) => ({ ordId }));
    if (exposedEntityTypes.length > 0) return exposedEntityTypes;
}

function traverseAssociationGraph(currentEntity, visited = []) {
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

    return [currentEntity, ...entitiesToVisit.flatMap((entity) => traverseAssociationGraph(entity, visited))];
}

module.exports = { createApiResources, mergeResourceProperties, buildResourceDefinitions };
