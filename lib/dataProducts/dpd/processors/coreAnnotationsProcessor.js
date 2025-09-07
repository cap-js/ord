const BaseProcessor = require("../../processors/baseProcessor");
const { Logger } = require("../../../logger");

class CoreAnnotationsProcessor extends BaseProcessor {
    process(dataProducts, context) {
        const { annotationReader } = context;
        Logger.info("CoreAnnotationsProcessor: Applying core annotations to data products");
        
        const annotatedDataProducts = dataProducts.map(dataProduct => {
            const serviceName = dataProduct.serviceName;
            const updated = { ...dataProduct };
            
            // Use simplified API - just ask for the property name
            const name = annotationReader.get(serviceName, 'name');
            if (name) updated.name = name;
            
            const version = annotationReader.get(serviceName, 'version');
            if (version) updated.version = version;
            
            // Check for @namespace annotation
            const namespace = annotationReader.get(serviceName, 'namespace');
            if (namespace) updated.namespace = namespace;
            
            const title = annotationReader.get(serviceName, 'title');
            if (title) updated.title = title;
            
            const description = annotationReader.get(serviceName, 'description');
            if (description) updated.description = description;
            
            const shortDescription = annotationReader.get(serviceName, 'shortDescription');
            if (shortDescription) updated.shortDescription = shortDescription;
            
            const type = annotationReader.get(serviceName, 'type');
            if (type) updated.type = type;
            
            const visibility = annotationReader.get(serviceName, 'visibility');
            if (visibility) updated.visibility = visibility;
            
            // Add category and partOfPackage (Schema v2 requirements)
            const category = annotationReader.get(serviceName, 'category');
            if (category) updated.category = category;
            
            const partOfPackage = annotationReader.get(serviceName, 'partOfPackage');
            if (partOfPackage) updated.partOfPackage = partOfPackage;
            
            // Add responsible annotation
            const responsible = annotationReader.get(serviceName, 'responsible');
            if (responsible) updated.responsible = responsible;
            
            // Add releaseStatus annotation
            const releaseStatus = annotationReader.get(serviceName, 'releaseStatus');
            if (releaseStatus) updated.releaseStatus = releaseStatus;
            
            // Add dataProducts for input dependencies (for derived data products)
            const dataProducts = annotationReader.get(serviceName, 'dataProducts');
            if (dataProducts) {
                updated.inputPorts = Array.isArray(dataProducts) ? dataProducts : [dataProducts];
            }
            
            // NEW: Add dpdType and dpdVersion for catman alignment
            const dpdType = annotationReader.get(serviceName, 'dpdType');
            if (dpdType) {
                updated.dpdType = dpdType;
            } else {
                // Set default if not specified
                updated.dpdType = 'sap.fos.dataproduct';
            }
            
            const dpdVersion = annotationReader.get(serviceName, 'dpdVersion');
            if (dpdVersion) {
                updated.dpdVersion = dpdVersion;
            } else {
                // Set default if not specified
                updated.dpdVersion = 'v2';
            }
            
            // NEW: Add dependsOn for data source dependencies
            const dependsOn = annotationReader.get(serviceName, 'dependsOn');
            if (dependsOn) {
                updated.dependsOn = Array.isArray(dependsOn) ? dependsOn : [dependsOn];
            }
            
            // NEW: Add shares for share references
            const shares = annotationReader.get(serviceName, 'shares');
            if (shares) {
                updated.shares = Array.isArray(shares) ? shares : [shares];
            }
            
            // NEW: Add datasets for dataset references
            const datasets = annotationReader.get(serviceName, 'datasets');
            if (datasets) {
                updated.datasets = Array.isArray(datasets) ? datasets : [datasets];
            }
            
            if (updated.version && updated.name) {
                updated.ordId = `${updated.namespace}:dataProduct:${updated.name}:v${updated.version}`;
            }
            
            if (name || version || title) {
                Logger.info(`Applied annotations to ${serviceName}`);
            }
            
            return updated;
        });
        
        return annotatedDataProducts;
    }
}

module.exports = CoreAnnotationsProcessor;