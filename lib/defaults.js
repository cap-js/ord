const {
    AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP,
    DESCRIPTION_PREFIX,
    OPEN_RESOURCE_DISCOVERY_VERSION,
    SHORT_DESCRIPTION_PREFIX,
} = require("./constants");
const { getAuthenticationTypes } = require("./authentication");

const regexWithRemoval = (name) => {
    return name?.replace(/[^a-zA-Z0-9]/g, "");
};

const nameWithDot = (name) => {
    return (
        regexWithRemoval(name.charAt(0)) + name.slice(1, name.length).replace(/[^a-zA-Z0-9]/g, ".")
    );
};

const nameWithSpaces = (name) => {
    return (
        regexWithRemoval(name.charAt(0)) + name.slice(1, name.length).replace(/[^a-zA-Z0-9]/g, " ")
    );
};

const defaultProductOrdId = (name) => `customer:product:${nameWithDot(name)}:`;

/**
 * Module containing default configuration for ORD Document.
 * @module defaults
 */
module.exports = {
    $schema:
        "https://sap.github.io/open-resource-discovery/spec-v1/interfaces/Document.schema.json",
    openResourceDiscovery: OPEN_RESOURCE_DISCOVERY_VERSION,
    policyLevel: "none",
    description: "this is an application description",
    products: (name) => [
        {
            ordId: defaultProductOrdId(name),
            title: nameWithSpaces(name),
            shortDescription: SHORT_DESCRIPTION_PREFIX + nameWithSpaces(name),
            vendor: "customer:vendor:customer:",
        },
    ],
    groupTypeId: "sap.cds:service",
    packages: function getPackageData(name, policyLevel, ordNamespace) {
        function createPackage(name, tag) {
            return {
                ordId: `${ordNamespace}:package:${regexWithRemoval(name
                )}${tag}`,
                title: nameWithSpaces(name),
                shortDescription:
                    SHORT_DESCRIPTION_PREFIX + nameWithSpaces(name),
                description: DESCRIPTION_PREFIX + nameWithSpaces(name),
                version: "1.0.0",
                partOfProducts: [defaultProductOrdId(name)],
                vendor: "customer:vendor:Customer:",
            };
        }

        if (policyLevel.split(":")[0].toLowerCase() === "sap") {
            return [
                createPackage(name, "-api:v1"),
                createPackage(name, "-event:v1"),
                createPackage(name, "-integrationDependency:v1"),
                createPackage(name, "-entityType:v1")
            ];
        } else {
            return [createPackage(name, ":v1")];
        }
    },
    consumptionBundles: (appConfig) => [
        {
            ordId: `${regexWithRemoval(appConfig.appName)}:consumptionBundle:noAuth:v1`,
            version: "1.0.0",
            lastUpdate: appConfig.lastUpdate,
            title: "Unprotected resources",
            shortDescription:
                "If we have another protected API then it will be another object",
            description:
                "This Consumption Bundle contains all resources of the reference app which are unprotected and do not require authentication",
        },
    ],

    apiResources: [],
    eventResources: [],
    entityTypes: [],
    baseTemplate: {
        openResourceDiscoveryV1: {
            documents: [
                {
                    url: "/ord/v1/documents/ord-document",
                    accessStrategies: getAuthenticationTypes().map((type) => ({
                        type: AUTH_TYPE_ORD_ACCESS_STRATEGY_MAP[type],
                    })),
                },
            ],
        },
    },
};
