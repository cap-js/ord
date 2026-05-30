const defaults = require("../defaults");
const { resolveServiceName, isValidService, resolveVisibility } = require("../common/utils");
const { RESOURCE_VISIBILITY } = require("../constants");

const RESOLVERS = Object.freeze({
    title: (service) => {
        return (
            service["@ORD.Extensions.title"] ??
            `${service.name
                .split(".")
                .pop()
                .replace(/Service(.*)$/, "")} Service`
        );
    },
    groupId: (service, appConfig) => {
        const namespace = appConfig.ordNamespace;
        const name = resolveServiceName(appConfig, service);

        return `${defaults.groupTypeId}:${namespace}:${name}`;
    },
});

/**
 * This is a template function to create group object of a service for groups array in ORD doc.
 *
 * @param {object} service The definition of the service
 * @param {object} appConfig - The application configuration.
 * @returns {Object} A group object.
 */
function createGroupsTemplateForService(service, appConfig) {
    return {
        groupTypeId: defaults.groupTypeId,

        title: RESOLVERS.title(service),
        groupId: RESOLVERS.groupId(service, appConfig),
    };
}

function createGroups(appConfig) {
    return Object.values(appConfig.csn.definitions)
        .filter((definition) => isValidService(definition))
        .filter((service) => resolveVisibility(appConfig, service) !== RESOURCE_VISIBILITY.private)
        .flatMap((service) => createGroupsTemplateForService(service, appConfig));
}

module.exports = {
    createGroups,
    createGroupsTemplateForService,
    RESOLVERS,
};
