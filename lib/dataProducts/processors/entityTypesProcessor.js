const BaseProcessor = require("./baseProcessor");
const { Logger } = require("../../logger");

class EntityTypesProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { csn, annotationReader, appConfig } = context;
        const namespace = appConfig?.ordNamespace || 'customer.default';

        Logger.info("EntityTypesProcessor: Extracting entity types from data products");

        const enrichedDataProducts = dataProducts.map(dataProduct => {
            const service = csn.definitions[dataProduct.serviceName];
            if (!service) {
                return dataProduct;
            }

            const updated = { ...dataProduct };
            const entityTypes = new Set();

            const annotations = annotationReader.get(dataProduct.serviceName);
            if (annotations?.entityTypes) {
                const annotatedTypes = Array.isArray(annotations.entityTypes)
                    ? annotations.entityTypes
                    : [annotations.entityTypes];
                annotatedTypes.forEach(type => entityTypes.add(type));
            }

            const servicePrefix = `${dataProduct.serviceName}.`;
            Object.entries(csn.definitions).forEach(([defName, def]) => {
                if (defName.startsWith(servicePrefix) && def.kind === 'entity') {
                    if (def['@ORD.entityType']) {
                        entityTypes.add(def['@ORD.entityType']);
                    } else {
                        const entityTypeName = defName.substring(servicePrefix.length);
                        const entityTypeId = `${namespace}:entityType:${entityTypeName}:v1`;
                        entityTypes.add(entityTypeId);
                    }
                }
            });

            if (entityTypes.size > 0) {
                updated.entityTypes = Array.from(entityTypes);
                Logger.info(`Found ${entityTypes.size} entity types for ${dataProduct.serviceName}`);
            }

            return updated;
        });

        return enrichedDataProducts;
    }
}

module.exports = EntityTypesProcessor;
