const { createProducts } = require("./product");
const { ORD_RESOURCE_TYPE, RESOURCE_VISIBILITY } = require("../constants");

function createPackage(appConfig, { label, visibility, productOrdId, resourceType }) {
    const tag = !resourceType ? "" : `-${resourceType}`;
    const overrides = appConfig?.env?.packages?.[0] ?? {};
    const name = appConfig.appName.replace(/[^a-zA-Z0-9]/g, " ").trim();
    const technicalName = appConfig.appName.replace(/[^a-zA-Z0-9]/g, "");
    const suffix = visibility === RESOURCE_VISIBILITY.public ? "" : `-${visibility}`;

    return {
        title: name,
        version: "1.0.0",
        vendor: "customer:vendor:Customer:",
        shortDescription: `Package containing ${visibility} ${label}`,
        description: `This package contains ${visibility} ${label} for ${name}.`,
        ordId: `${appConfig.ordNamespace}:package:${technicalName}${tag}${suffix}:v1`,
        ...(productOrdId && { partOfProducts: [productOrdId] }),
        ...overrides,
    };
}

function createPackages(appConfig) {
    const productOrdId = appConfig.existingProductORDId || createProducts(appConfig)?.[0]?.ordId;
    const visibilities = !appConfig.hasSAPPolicyLevel
        ? [RESOURCE_VISIBILITY.public]
        : Object.values(RESOURCE_VISIBILITY);
    const packageTypes = !appConfig.hasSAPPolicyLevel
        ? [{ label: "General" }]
        : [
              { label: "APIs", resourceType: ORD_RESOURCE_TYPE.api },
              { label: "Events", resourceType: ORD_RESOURCE_TYPE.event },
              { label: "Entity Types", resourceType: ORD_RESOURCE_TYPE.entityType },
              { label: "Data Products", resourceType: ORD_RESOURCE_TYPE.dataProduct },
              { label: "Integration Dependencies", resourceType: ORD_RESOURCE_TYPE.integrationDependency },
          ];

    return packageTypes.flatMap(({ label, resourceType }) =>
        visibilities.map((visibility) =>
            createPackage(appConfig, {
                label,
                visibility,
                productOrdId,
                resourceType,
            }),
        ),
    );
}

module.exports = {
    createPackages,
    createPackage,
};
