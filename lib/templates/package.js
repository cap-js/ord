const _ = require("lodash");

const { createProducts } = require("./product");
const { CONTENT_MERGE_KEY, ORD_RESOURCE_TYPE, RESOURCE_VISIBILITY } = require("../constants");

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

const nameWithSpaces = (name) => {
    return regexWithRemoval(name.charAt(0)) + name.slice(1, name.length).replace(/[^a-zA-Z0-9]/g, " ");
};

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

function createPackages(appConfig) {
    const name = appConfig.appName;
    const products = createProducts(appConfig);
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
                version: "1.0.0",
                title: nameWithSpaces(name),
                vendor: vendor || "customer:vendor:Customer:",
                shortDescription: `Package containing ${visibility} ${type}`,
                ordId: generateUniquePackageOrdId(ordNamespace, name, tag, visibility),
                description: `This package contains ${visibility} ${type} for ${nameWithSpaces(name)}.`,
                ...(productsOrdId && { partOfProducts: [productsOrdId] }),
                ...envValues,
            })),
        ),
        CONTENT_MERGE_KEY,
    );
}

module.exports = {
    createPackages,
};
