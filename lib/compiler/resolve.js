const defaults = require("../defaults");
const { createAuthConfig } = require("../auth/authentication");
const { createIntegrationDependency } = require("../integration-dependency");
const {
    createApiResources,
    createEventResource,
    createEntityTypes,
    createGroup,
    createProducts,
    createPackages,
    createConsumptionBundles,
} = require("../model");

function resolve(document) {
    const { config, services, entities, externalServices } = document;

    const authConfig = createAuthConfig();
    if (authConfig.error) {
        throw new Error(`Authentication configuration error: ${authConfig.error}`);
    }
    const accessStrategies = authConfig.accessStrategies;

    config.policyLevels =
        config.env?.policyLevels || (config.env?.policyLevel && [config.env.policyLevel]) || defaults.policyLevels;

    const products = createProducts(config);
    const packages = createPackages(config, products);
    const packageIds = packages.map((p) => p.ordId);
    const consumptionBundles = createConsumptionBundles(config);

    const groups = services.map((svc) => createGroup(svc, config)).filter(Boolean);

    const apiResources = services
        .filter((svc) => svc.protocols.length > 0)
        .flatMap((svc) => createApiResources(svc, config, packageIds, accessStrategies));

    const eventResources = services
        .filter((svc) => svc.hasEvents)
        .flatMap((svc) => createEventResource(svc, config, packageIds, accessStrategies));

    const entityTypes = createEntityTypes(entities, config, packageIds);

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

    document.resolved = {
        products,
        packages,
        consumptionBundles,
        groups,
        apiResources,
        eventResources,
        entityTypes,
        integrationDependencies,
    };
    return document;
}

module.exports = { resolve };
