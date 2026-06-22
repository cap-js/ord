const defaults = require("./defaults");
const utils = require("./common/utils");
const Configuration = require("./configuration");
const { createGroups } = require("./templates/group");
const { createPackages } = require("./templates/package");
const { createProducts } = require("./templates/product");
const { createEntityTypes } = require("./templates/entity-type");
const { createAPIResources } = require("./templates/api-resource");
const { createEventResources } = require("./templates/event-resource");
const { createIntegrationDependencies } = require("./templates/integration-dependency");
const {
    getCustomORDContent,
    compareAndHandleCustomORDContentWithExistingContent,
} = require("./extend-ord-with-custom");
const { withSpan, documentGenerationDuration } = require("./telemetry");

function prune(document) {
    const usedPackageIds = new Set(
        document.packages?.length === 0
            ? []
            : [
                  ...(document.entityTypes?.map((et) => et.partOfPackage) ?? []),
                  ...(document.dataProducts?.map((dp) => dp.partOfPackage) ?? []),
                  ...(document.apiResources?.map((ar) => ar.partOfPackage) ?? []),
                  ...(document.eventResources?.map((er) => er.partOfPackage) ?? []),
                  ...(document.integrationDependencies?.map((id) => id.partOfPackage) ?? []),
              ],
    );

    return utils.prune(
        Object.assign(document, {
            // remove unused packages
            packages: document.packages?.filter((pkg) => usedPackageIds.has(pkg.ordId)),
        }),
    );
}

function extend(extensions, document) {
    return extensions.reduce(
        (ord, extension) => compareAndHandleCustomORDContentWithExistingContent(ord, extension),
        document,
    );
}

module.exports = (csn, extensions) => {
    const extensionCount = Array.isArray(extensions) ? extensions.length : 0;
    return withSpan(
        "ord.document.generate",
        {
            "ord.extensions.count": extensionCount,
        },
        (span) => {
            const startedAt = process.hrtime.bigint();
            const appConfig = new Configuration(csn);

            const document = prune(
                extend(
                    [...(extensions || []), getCustomORDContent(appConfig)].filter(Boolean), //
                    {
                        $schema: defaults.$schema,
                        groups: createGroups(appConfig),
                        baseUrl: appConfig?.env?.baseUrl,
                        products: createProducts(appConfig),
                        packages: createPackages(appConfig),
                        policyLevels: appConfig.policyLevels,
                        entityTypes: createEntityTypes(appConfig),
                        apiResources: createAPIResources(appConfig),
                        eventResources: createEventResources(appConfig),
                        consumptionBundles: appConfig.env?.consumptionBundles,
                        description: appConfig.env?.description ?? defaults.description,
                        integrationDependencies: createIntegrationDependencies(appConfig),
                        openResourceDiscovery: appConfig.env?.openResourceDiscovery ?? defaults.openResourceDiscovery,
                    },
                ),
            );

            // Span attributes useful for filtering in the backend. `setAttributes`
            // silently drops `undefined` values, so no manual guarding needed.
            span.setAttributes({
                "ord.namespace": appConfig?.env?.namespace,
                "ord.resources.api.count": document.apiResources?.length ?? 0,
                "ord.resources.event.count": document.eventResources?.length ?? 0,
                "ord.resources.entity_type.count": document.entityTypes?.length ?? 0,
                "ord.packages.count": document.packages?.length ?? 0,
            });

            // Duration histogram doubles as a request count via its `_count`
            // aggregation, so no separate counter is needed.
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
            documentGenerationDuration.record(durationMs, {
                "ord.namespace": appConfig?.env?.namespace,
            });

            return document;
        },
    );
};
