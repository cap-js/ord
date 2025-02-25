const {
    OPEN_RESOURCE_DISCOVERY_VERSION,
    SHORT_DESCRIPTION_PREFIX,
} = require("./constants");
const { getAuthConfig } = require("./authentication");

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
 * Generates dynamic description and short description for a package based on its type.
 * @param {string} name - The package name.
 * @param {string} type - The package type (API, Event, Consumption Bundle, etc.).
 * @param {boolean} isInternal - Defines if the package is internal or public.
 * @returns {object} Object containing the description and short description.
 */
const generatePackageDescriptions = (name, type, isInternal) => {
    const visibility = isInternal ? "internal" : "public";
    return {
        shortDescription: `Package containing ${visibility} ${type}`,
        description: `This package contains ${visibility} ${type} for ${nameWithSpaces(name)}.`,
    };
};

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
        function createPackage(name, tag, type, isInternal = false) {
            const { shortDescription, description } = generatePackageDescriptions(name, type, isInternal);
            return {
                ordId: `${ordNamespace}:package:${regexWithRemoval(name
                )}${tag}`,
                title: nameWithSpaces(name),
                shortDescription: shortDescription,
                description: description,
                version: "1.0.0",
                partOfProducts: [defaultProductOrdId(name)],
                vendor: "customer:vendor:Customer:",
            };
        }

        if (policyLevel.split(":")[0].toLowerCase() === "sap") {
            return [
                createPackage(name, "-api:v1", "APIs"),
                createPackage(name, "-api-internal:v1", "APIs", true),
                createPackage(name, "-event:v1", "Events"),
                createPackage(name, "-event-internal:v1", "Events", true),
                createPackage(name, "-consumptionBundle:v1", "Consumption Bundles"),
                createPackage(name, "-consumptionBundle-internal:v1", "Consumption Bundles", true),
                createPackage(name, "-integrationDependency:v1", "Integration Dependencies"),
                createPackage(name, "-integrationDependency-internal:v1", "Integration Dependencies", true),
                createPackage(name, "-entityType:v1", "Entity Types"),
                createPackage(name, "-entityType-internal:v1", "Entity Types", true),
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
                    accessStrategies: getAuthConfig().accessStrategies
                },
            ],
        },
    },
};
