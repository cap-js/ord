const fs = require("fs");
const _ = require("lodash");
const cds = require("@sap/cds");
const { join } = require("path");

const { getAccessStrategiesFromAuthConfig } = require("./access-strategies");
const {
    ORD_RESOURCE_TYPE,
    SHORT_DESCRIPTION_PREFIX,
    RESOURCE_VISIBILITY,
    DOCUMENT_PERSPECTIVES,
    CONTENT_MERGE_KEY,
    LOCAL_TENANT_ID_HEADER_KEY,
} = require("./constants");
const { split } = require("./common/slice");
const ord = require("./ord");

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
    sizeLimit: 2000000, // 2mb
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
    baseTemplate: (authConfig, model, tenantModel) => {
        const extensions = Array.from(Object.values(this.extensions));
        const accessStrategies = getAccessStrategiesFromAuthConfig(authConfig?.accessStrategies || []);

        return {
            openResourceDiscoveryV1: {
                documents: [
                    ...Array(split(ord(model, extensions)).length)
                        .fill(0)
                        .map((_, i) => {
                            return {
                                url: `/ord/v1/documents/ord-document?part=${i}`,
                                perspective: DOCUMENT_PERSPECTIVES.SystemVersion,
                                accessStrategies,
                            };
                        }),
                    ...(!tenantModel
                        ? []
                        : Array(split(ord(tenantModel, extensions)).length)
                              .fill(0)
                              .map((_, i) => {
                                  return {
                                      url: `/ord/v1/documents/ord-document?part=${i}&perspective=${encodeURIComponent(DOCUMENT_PERSPECTIVES.SystemInstance)}`,
                                      perspective: DOCUMENT_PERSPECTIVES.SystemInstance,
                                      accessStrategies,
                                  };
                              })),
                ],
            },
        };
    },
    adjustForPerspective: (document, perspective) => {
        document.perspective = perspective;

        if (perspective === DOCUMENT_PERSPECTIVES.SystemVersion) {
            document.describedSystemVersion = cds.env["ord"]?.describedSystemVersion ?? {
                version: JSON.parse(fs.readFileSync(join(cds.root, "package.json"), "utf-8")).version,
            };
        } else if (perspective === DOCUMENT_PERSPECTIVES.SystemInstance) {
            (document.apiResources || []).forEach((apiResource) => {
                (apiResource.resourceDefinitions || []).forEach((apiResourceDefinition) => {
                    apiResourceDefinition.url += `?perspective=${encodeURIComponent(perspective)}`;
                });
            });

            (document.eventResources || []).forEach((eventResource) => {
                (eventResource.resourceDefinitions || []).forEach((eventResourceDefinition) => {
                    eventResourceDefinition.url += `?perspective=${encodeURIComponent(perspective)}`;
                });
            });
        }

        return document;
    },
};
