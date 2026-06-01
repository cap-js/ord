const _ = require("lodash");
const cds = require("@sap/cds");

const Logger = require("./logger");
const defaults = require("./defaults");
const Configuration = require("./configuration");
const { createGroupsTemplateForService } = require("./templates/group");
const { createEntityTypeTemplate } = require("./templates/entity-type");
const { createAPIResourceTemplate } = require("./templates/api-resource");
const { createEventResourceTemplate } = require("./templates/event-resource");
const { createIntegrationDependency } = require("./templates/integration-dependency");
const { isValidService, resolveVisibility, isEventsOnlyService, isExposedEntityType } = require("./common/utils");
const { CONTENT_MERGE_KEY, RESOURCE_VISIBILITY, CDS_ELEMENT_KIND } = require("./constants");
const {
    getCustomORDContent,
    compareAndHandleCustomORDContentWithExistingContent,
} = require("./extend-ord-with-custom");

const _getGroups = (appConfig) => {
    return Object.values(appConfig.csn.definitions)
        .filter((definition) => isValidService(definition))
        .filter((service) => resolveVisibility(appConfig, service) !== RESOURCE_VISIBILITY.private)
        .flatMap((service) => createGroupsTemplateForService(service, appConfig));
};

const _getProducts = (appConfig) => {
    const productsObj = defaults.products(appConfig.packageName);

    if (appConfig.env?.products) {
        const customProducts = appConfig.env.products[0];
        if (customProducts?.ordId?.toLowerCase().startsWith("sap")) {
            Logger.error(
                "Detected sap product ordId, which should not be defined for custom products, use default value instead. Please check ord global registry.",
            );
        } else {
            _.assign(productsObj[0], customProducts);
        }
    }

    return productsObj;
};

const _getEntityTypes = (appConfig) => {
    return appConfig.hasSAPPolicyLevel
        ? [] // If SAP policy level is present, don't create entity type, they must be in the central repository
        : _.uniqBy(
              Object.values(appConfig.csn.definitions)
                  .filter((definition) => isExposedEntityType(definition))
                  .map((entity) => createEntityTypeTemplate(appConfig, entity))
                  .filter((entity) => entity.visibility !== RESOURCE_VISIBILITY.private),
              CONTENT_MERGE_KEY,
          );
};

const _getAPIResources = (appConfig) => {
    return Object.values(appConfig.csn.definitions)
        .filter((definition) => isValidService(definition) && !isEventsOnlyService(definition))
        .flatMap((service) => createAPIResourceTemplate(service, appConfig));
};

const _getEventResources = (appConfig) => {
    const services = _.uniq(
        Object.values(appConfig.csn.definitions)
            .filter((definition) => definition.kind === CDS_ELEMENT_KIND.event)
            .filter((definition) => isValidService(definition["_service"]))
            .map((definition) => definition["_service"]),
    );

    return services
        .map((service) => createEventResourceTemplate(service, appConfig))
        .filter((resource) => resource.visibility !== RESOURCE_VISIBILITY.private);
};

const _getIntegrationDependencies = (appConfig) => {
    return [createIntegrationDependency(appConfig)] //
        .filter((dependency) => dependency.aspects?.length > 0);
};

const _filterUnusedPackages = (ordDocument) => {
    if (!ordDocument.packages?.length) return [];

    const usedPackageIds = new Set();

    ordDocument.apiResources?.forEach((api) => usedPackageIds.add(api.partOfPackage));
    ordDocument.eventResources?.forEach((event) => usedPackageIds.add(event.partOfPackage));
    ordDocument.dataProducts?.forEach((dp) => usedPackageIds.add(dp.partOfPackage));
    ordDocument.integrationDependencies?.forEach((dep) => usedPackageIds.add(dep.partOfPackage));
    ordDocument.entityTypes?.forEach((et) => {
        if (et?.partOfPackage) {
            usedPackageIds.add(et.partOfPackage);
        }
    });

    return ordDocument.packages.filter((pkg) => usedPackageIds.has(pkg.ordId));
};

module.exports = (csn, extensions = []) => {
    const appConfig = new Configuration(cds.linked(csn));
    const groups = _getGroups(appConfig);
    const products = _getProducts(appConfig);
    const entityTypes = _getEntityTypes(appConfig);
    const apiResources = _getAPIResources(appConfig);
    const eventResources = _getEventResources(appConfig);
    const consumptionBundles = appConfig.env?.consumptionBundles ?? [];
    const integrationDependencies = _getIntegrationDependencies(appConfig);
    const ordDocument = [...(extensions || []), getCustomORDContent(appConfig)]
        .filter((extension) => !!extension)
        .reduce((document, extension) => compareAndHandleCustomORDContentWithExistingContent(document, extension), {
            // Unconditionally added top-level properties
            $schema: "https://open-resource-discovery.github.io/specification/spec-v1/interfaces/Document.schema.json",
            policyLevels: appConfig.policyLevels,
            packages: defaults.packages(appConfig, products),
            description: appConfig.env?.description || defaults.description,
            openResourceDiscovery: appConfig.env?.openResourceDiscovery || defaults.openResourceDiscovery,

            // Conditionally added top-level properties
            ...(!groups.length ? {} : { groups: groups }),
            ...(!entityTypes.length ? {} : { entityTypes: entityTypes }),
            ...(!apiResources.length ? {} : { apiResources: apiResources }),
            ...(!eventResources.length ? {} : { eventResources: eventResources }),
            ...(appConfig.existingProductORDId ? {} : { products: [products[0]] }),
            ...(!consumptionBundles.length ? {} : { consumptionBundles: consumptionBundles }),
            ...(!integrationDependencies.length ? {} : { integrationDependencies: integrationDependencies }),
        });

    return Object.assign(ordDocument, { packages: _filterUnusedPackages(ordDocument) });
};
