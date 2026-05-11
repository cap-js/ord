const { ensureAccessStrategies } = require("../access-strategies");
const { ORD_RESOURCE_TYPE, RESOURCE_VISIBILITY } = require("../constants");
const { determineVisibility } = require("./visibility");
const { stripNamespacePrefix, buildGroupId, findPackageId } = require("./naming");
const { mergeResourceProperties } = require("./api-resource");

function createEventResource(service, config, packageIds, accessStrategies) {
    const { extensions, definition } = service;
    const visibility = determineVisibility(extensions, definition, config);

    if (visibility === RESOURCE_VISIBILITY.private) return [];
    if (visibility !== RESOURCE_VISIBILITY.public && visibility !== RESOURCE_VISIBILITY.internal) return [];

    const packageId = findPackageId(config.ordNamespace, packageIds, ORD_RESOURCE_TYPE.event, visibility);
    const ordId = `${config.ordNamespace}:eventResource:${stripNamespacePrefix(service, config)}:v1`;

    const resource = mergeResourceProperties(service, config, {
        packageId,
        ordId,
        version: "1.0.0",
        fallbackTitle: `ODM ${config.appName.replace(/[^a-zA-Z0-9]/g, "")} Events`,
        fallbackShortDescription: `${service.name} event resource`,
        fallbackDescription: "CAP Event resource describing events / messages.",
    });

    if (!resource.resourceDefinitions) {
        resource.resourceDefinitions = [
            {
                type: "asyncapi-v2",
                mediaType: "application/json",
                url: `/ord/v1/${resource.ordId}/${service.name}.asyncapi2.json`,
                accessStrategies: ensureAccessStrategies(accessStrategies, {
                    resourceName: `${service.name} (asyncapi-v2)`,
                }),
            },
        ];
    }

    return [resource];
}

module.exports = { createEventResource };
