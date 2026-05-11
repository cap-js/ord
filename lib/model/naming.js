const defaults = require("../defaults");
const { RESOURCE_VISIBILITY } = require("../constants");

function stripNamespacePrefix(service, config) {
    const name = service.definition.name;
    let localName = name;
    if (config.internalNamespace && startsWithNamespace(name, config.internalNamespace)) {
        localName = name.substring(config.internalNamespace.length);
    } else if (startsWithNamespace(name, config.ordNamespace)) {
        localName = name.substring(config.ordNamespace.length);
    }
    if (localName.startsWith(".")) localName = localName.substring(1);
    return localName;
}

function startsWithNamespace(name, namespace) {
    if (!name.startsWith(namespace)) return false;
    const rest = name.substring(namespace.length);
    return rest === "" || rest.startsWith(".");
}

function buildGroupId(service, config) {
    return `${defaults.groupTypeId}:${config.ordNamespace}:${stripNamespacePrefix(service, config)}`;
}

function findPackageId(namespace, packageIds, resourceType, visibility = RESOURCE_VISIBILITY.public) {
    if (!packageIds) return;
    return (
        packageIds.find((id) => {
            if (visibility === RESOURCE_VISIBILITY.public) {
                return id.includes(resourceType) && !id.includes("-internal") && !id.includes("-private");
            }
            return id.includes(`${resourceType}-${visibility}`);
        }) || packageIds.find((id) => id.includes(namespace))
    );
}

module.exports = { stripNamespacePrefix, startsWithNamespace, buildGroupId, findPackageId };
