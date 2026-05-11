const { createApiResources, mergeResourceProperties, buildResourceDefinitions } = require("./apiResource");
const { createEventResources } = require("./eventResource");
const { createEntityTypes, hasSAPPolicyLevel } = require("./entityType");
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
