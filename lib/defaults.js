const {
    OPEN_RESOURCE_DISCOVERY_VERSION,
    SHORT_DESCRIPTION_PREFIX,
    RESOURCE_VISIBILITY,
} = require("./constants");
const { getAuthConfig } = require("./authentication");

 /**
 * Creates packages dynamically for all visibility levels.
 */
 const packageTypes = [
    { tag: "-api", type: "APIs" },
    { tag: "-event", type: "Events" },
    { tag: "-consumptionBundle", type: "Consumption Bundles" },
    { tag: "-integrationDependency", type: "Integration Dependencies" },
    { tag: "-entityType", type: "Entity Types" },
    { tag: "-dataProduct", type: "Data Products" },
];

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
 * Generates dynamic description and short description for a package.
 */
const generatePackageDescriptions = (name, type, visibility) => ({
    shortDescription: `Package containing ${visibility} ${type}`,
    description: `This package contains ${visibility} ${type} for ${nameWithSpaces(name)}.`,
});

/**
 * Generates a unique ORD ID for a package.
 */
const generateUniquePackageOrdId = (ordNamespace, name, tag, visibility) => {
    const visibilitySuffix = visibility === RESOURCE_VISIBILITY.public ? "" : `-${visibility}`;
    return `${ordNamespace}:package:${regexWithRemoval(name)}${tag}${visibilitySuffix}:v1`;
};


/**
 * Module containing default configuration for ORD Document.
 * @module defaults
 */
module.exports = {
    $schema:
        "https://open-resource-discovery.github.io/specification/spec-v1/interfaces/Document.schema.json",
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
        if (policyLevel.split(":")[0].toLowerCase() === "sap") {
            return packageTypes.flatMap(({ tag, type }) =>
                Object.values(RESOURCE_VISIBILITY).map((visibility) => ({
                    ordId: generateUniquePackageOrdId(ordNamespace, name, tag, visibility),
                    title: nameWithSpaces(name),
                    ...generatePackageDescriptions(name, type, visibility),
                    version: "1.0.0",
                    partOfProducts: [defaultProductOrdId(name)],
                    vendor: "customer:vendor:Customer:",
                }))
            );
        } else {
            return [
                {
                    ordId: generateUniquePackageOrdId(ordNamespace, name, "", RESOURCE_VISIBILITY.public),
                    title: nameWithSpaces(name),
                    ...generatePackageDescriptions(name, "General", RESOURCE_VISIBILITY.public),
                    version: "1.0.0",
                    partOfProducts: [defaultProductOrdId(name)],
                    vendor: "customer:vendor:Customer:",
                },
            ];
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
                    accessStrategies: getAuthConfig().accessStrategies
                },
            ],
        },
    },
};
