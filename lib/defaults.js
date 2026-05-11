const fs = require("fs");
const { join } = require("path");
const _ = require("lodash");
const cds = require("@sap/cds");

const {
    ORD_RESOURCE_TYPE,
    SHORT_DESCRIPTION_PREFIX,
    RESOURCE_VISIBILITY,
    DOCUMENT_PERSPECTIVES,
    CONTENT_MERGE_KEY,
} = require("./constants");

const stringTypeCheck = (value) => typeof value === "string";
const arrayTypeCheck = (value) => Array.isArray(value);

// see ref: https://pages.github.tools.sap/CentralEngineering/open-resource-discovery-specification/spec-v1/interfaces/document#package
const packageTypeChecks = {
    policyLevels: arrayTypeCheck,
    packageLinks: arrayTypeCheck,
    links: arrayTypeCheck,
    licenseType: stringTypeCheck,
    supportInfo: stringTypeCheck,
    vendor: stringTypeCheck,
    countries: arrayTypeCheck,
    lineOfBusiness: arrayTypeCheck,
    industry: arrayTypeCheck,
    runtimeRestriction: stringTypeCheck,
    tags: arrayTypeCheck,
    labels: arrayTypeCheck,
    documentationLabels: arrayTypeCheck,
};

const regexWithRemoval = (name) => {
    return name?.replace(/[^a-zA-Z0-9]/g, "");
};

const nameWithDot = (name) => {
    return regexWithRemoval(name.charAt(0)) + name.slice(1, name.length).replace(/[^a-zA-Z0-9]/g, ".");
};

const nameWithSpaces = (name) => {
    return regexWithRemoval(name.charAt(0)) + name.slice(1, name.length).replace(/[^a-zA-Z0-9]/g, " ");
};

const defaultProductOrdId = (name) => `customer:product:${nameWithDot(name)}:`;

const generatePackageDescriptions = (name, type, visibility) => ({
    shortDescription: `Package containing ${visibility} ${type}`,
    description: `This package contains ${visibility} ${type} for ${nameWithSpaces(name)}.`,
});

const generateUniquePackageOrdId = (ordNamespace, name, tag, visibility) => {
    const visibilitySuffix = visibility === RESOURCE_VISIBILITY.public ? "" : `-${visibility}`;
    return `${ordNamespace}:package:${regexWithRemoval(name)}${tag}${visibilitySuffix}:v1`;
};

const mapEnvPackageInfo = (packageConfig) => {
    if (!packageConfig) {
        return { vendor: undefined };
    }

    const filteredEnv = {};
    for (const key in packageConfig) {
        const value = packageConfig[key];
        const checkFunction = packageTypeChecks[key];
        if (value && checkFunction && checkFunction(value)) {
            filteredEnv[key] = value;
        }
    }
    return filteredEnv;
};

/**
 * Module containing default configuration for ORD Document.
 * @module defaults
 */
module.exports = {
    $schema: "https://open-resource-discovery.github.io/specification/spec-v1/interfaces/Document.schema.json",
    openResourceDiscovery: "1.14",
    policyLevels: ["none"],
    groupTypeId: "sap.cds:service",
    description: "this is an application description",
    products: (name) => [
        {
            ordId: defaultProductOrdId(name),
            title: nameWithSpaces(name),
            shortDescription: SHORT_DESCRIPTION_PREFIX + nameWithSpaces(name),
            vendor: "customer:vendor:Customer:",
        },
    ],
    packages: (appConfig, products) => {
        const name = appConfig.appName;
        const ordNamespace = appConfig.ordNamespace;
        const productsOrdId = appConfig.existingProductORDId || products?.[0]?.ordId;
        const { vendor, ...envValues } = mapEnvPackageInfo(appConfig?.env?.packages?.[0]);
        const visibilities = !appConfig.hasSAPPolicyLevel
            ? [RESOURCE_VISIBILITY.public]
            : Object.values(RESOURCE_VISIBILITY);
        const packageTypes = !appConfig.hasSAPPolicyLevel
            ? [{ tag: "", type: "General" }]
            : [
                  { tag: `-${ORD_RESOURCE_TYPE.api}`, type: "APIs" },
                  { tag: `-${ORD_RESOURCE_TYPE.event}`, type: "Events" },
                  { tag: `-${ORD_RESOURCE_TYPE.entityType}`, type: "Entity Types" },
                  { tag: `-${ORD_RESOURCE_TYPE.dataProduct}`, type: "Data Products" },
                  { tag: `-${ORD_RESOURCE_TYPE.integrationDependency}`, type: "Integration Dependencies" },
              ];

        return _.uniqBy(
            packageTypes.flatMap(({ tag, type }) =>
                visibilities.map((visibility) => ({
                    ordId: generateUniquePackageOrdId(ordNamespace, name, tag, visibility),
                    title: nameWithSpaces(name),
                    ...generatePackageDescriptions(name, type, visibility),
                    version: "1.0.0",
                    ...(productsOrdId && { partOfProducts: [productsOrdId || defaultProductOrdId(name)] }),
                    vendor: vendor || "customer:vendor:Customer:",
                    ...envValues,
                })),
            ),
            CONTENT_MERGE_KEY,
        );
    },
    consumptionBundles: (appConfig) => [
        {
            ordId: `${regexWithRemoval(appConfig.appName)}:consumptionBundle:noAuth:v1`,
            version: "1.0.0",
            lastUpdate: appConfig.lastUpdate,
            title: "Unprotected resources",
            shortDescription: "If we have another protected API then it will be another object",
            description:
                "This Consumption Bundle contains all resources of the reference app which are unprotected and do not require authentication",
        },
    ],
    baseTemplate: (authConfig) => {
        // Get access strategies from the provided authConfig
        // If auth config is not available, fall back to empty array
        const accessStrategies = authConfig?.accessStrategies || [];
        return {
            openResourceDiscoveryV1: {
                documents: [
                    {
                        url: "/ord/v1/documents/ord-document",
                        perspective: DOCUMENT_PERSPECTIVES.SystemVersion,
                        accessStrategies,
                    },
                ],
            },
        };
    },
    resolveDocumentPerspectiveExtension: () => {
        return {
            perspective: DOCUMENT_PERSPECTIVES.SystemVersion,
            describedSystemVersion: cds.env["ord"]?.describedSystemVersion ?? {
                version: JSON.parse(fs.readFileSync(join(cds.root, "package.json"), "utf-8")).version,
            },
        };
    },
};
