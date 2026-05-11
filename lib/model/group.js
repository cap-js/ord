const defaults = require("../defaults");
const { RESOURCE_VISIBILITY } = require("../constants");
const { determineVisibility } = require("./visibility");
const { buildGroupId } = require("./naming");

function createGroup(service, config) {
    const { extensions, definition } = service;
    const visibility = determineVisibility(extensions, definition, config);
    if (visibility === RESOURCE_VISIBILITY.private) return null;

    return {
        groupId: buildGroupId(service, config),
        groupTypeId: defaults.groupTypeId,
        title: extensions.title ?? formatServiceTitle(service.name),
    };
}

function formatServiceTitle(name) {
    const serviceName = name.substring(name.lastIndexOf(".") + 1);
    const index = serviceName.indexOf("Service");
    if (index >= 0) return `${serviceName.substring(0, index)} Service`;
    return `${serviceName} Service`;
}

module.exports = { createGroup };
