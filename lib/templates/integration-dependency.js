const { createPackages } = require("./package");
const { readORDExtensions, isExternalDataProduct } = require("../common/utils");
const { RESOURCE_VISIBILITY, EXTERNAL_DP_ORD_ID_ANNOTATION } = require("../constants");

const RESOLVERS = Object.freeze({
    ordId: (appConfig) => {
        const namespace = appConfig.ordNamespace;
        const major = RESOLVERS.version(appConfig).split(".")[0];

        return (
            appConfig.env?.integrationDependency?.ordId?.replace(/\{namespace}/g, namespace) ??
            `${namespace}:integrationDependency:externalDependencies:v${major}`
        );
    },
    version: (appConfig) => {
        return appConfig.env?.integrationDependency?.version || "1.0.0";
    },
    aspects: (appConfig) => {
        return (
            appConfig.env?.integrationDependency?.aspects ??
            Object.values(appConfig.csn.definitions)
                .filter((definition) => isExternalDataProduct(definition))
                .filter((service) => "apiResource" === service[EXTERNAL_DP_ORD_ID_ANNOTATION].split(":")[1])
                .map((service) => {
                    const version = service[EXTERNAL_DP_ORD_ID_ANNOTATION].split(":")[3] ?? "v1";

                    return {
                        title: service.name,
                        mandatory: false,
                        apiResources: [
                            {
                                ordId: service[EXTERNAL_DP_ORD_ID_ANNOTATION],
                                minVersion: version.replace("v", "") + ".0.0",
                            },
                        ],

                        ...readORDExtensions(service), // Allow customization via @ORD.Extensions on the service
                    };
                })
        );
    },
    visibility: (appConfig) => {
        return appConfig.env?.integrationDependency?.visibility || RESOURCE_VISIBILITY.public;
    },
    partOfPackage: (appConfig) => {
        const visibility = RESOLVERS.visibility(appConfig);
        const name = appConfig.appName?.replace(/[^a-zA-Z0-9]/g, "");
        const packages = createPackages(appConfig).map((pkg) => pkg.ordId);
        const suffix = visibility === RESOURCE_VISIBILITY.public ? "" : `-${visibility}`;

        return (
            appConfig.env?.integrationDependency?.partOfPackage?.replace(/\{namespace}/g, appConfig.ordNamespace) ??
            [
                `${appConfig.ordNamespace}:package:${name}-integrationDependency${suffix}:v1`,
                `${appConfig.ordNamespace}:package:${name}:v1`,
            ].find((candidate) => packages.includes(candidate))
        );
    },
});

/**
 * Creates a single IntegrationDependency with one aspect per external service.
 * @param {Object} appConfig - The application configuration
 * @returns {Object} IntegrationDependency object
 */
function createIntegrationDependency(appConfig) {
    return {
        mandatory: false,
        releaseStatus: "active",
        title: "External Dependencies",

        ...(appConfig.env?.integrationDependency ?? {}), // Allow customization via cdsrc

        ordId: RESOLVERS.ordId(appConfig),
        version: RESOLVERS.version(appConfig),
        aspects: RESOLVERS.aspects(appConfig),
        visibility: RESOLVERS.visibility(appConfig),
        partOfPackage: RESOLVERS.partOfPackage(appConfig),
    };
}

function createIntegrationDependencies(appConfig) {
    return [createIntegrationDependency(appConfig)] //
        .filter((dependency) => dependency.aspects?.length > 0);
}

module.exports = {
    createIntegrationDependencies,
    createIntegrationDependency,
    RESOLVERS,
};
