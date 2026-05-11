const { createApiResources, mergeResourceProperties, buildResourceDefinitions } = require("./api-resource");
const { createEventResources } = require("./event-resource");
const { createEntityTypes, hasSAPPolicyLevel } = require("./entity-type");
const { createGroup } = require("./group");
const { createProducts, createPackages, createConsumptionBundles } = require("./package");
const { determineVisibility, isPrimaryDataProductService } = require("./visibility");
const { stripNamespacePrefix, buildGroupId, findPackageId, startsWithNamespace } = require("./naming");

module.exports = {
    createApiResources,
    createEventResources,
    createEntityTypes,
    createGroup,
    createProducts,
    createPackages,
    createConsumptionBundles,
    determineVisibility,
    isPrimaryDataProductService,
    stripNamespacePrefix,
    buildGroupId,
    findPackageId,
    startsWithNamespace,
    hasSAPPolicyLevel,
    mergeResourceProperties,
    buildResourceDefinitions,
};
