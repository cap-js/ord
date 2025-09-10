const { createDataProductProcessor } = require("../processors/processor");
const { buildDpdObject } = require("./dpdFactory");
const { buildTransformerObject } = require("../transformer/transformerFactory");
const { buildShareObject } = require("../share/shareFactory");
const { buildCsnObject } = require("../csn/csnFactory");
const { Logger } = require("../../logger");
const { AnnotationReader } = require("../annotationReader");

/**
 * Generate data product files from CSN
 * @param {object} csn - Compiled Service Network
 * @param {object} appConfig - Application configuration
 * @returns {Promise<Array>} - Array of file objects with path and content
 */
async function generateDataProductFiles(csn, appConfig) {
    const files = [];
    
    const processor = createDataProductProcessor();
    
    const annotationReader = new AnnotationReader(csn.definitions, [
        '@DataIntegration.dataProduct',
        '@ORD.dataProduct',
        '@'
    ]);
    
    const transformerAnnotationReader = new AnnotationReader(csn.definitions, [
        '@transformer'
    ]);
    
    const shareAnnotationReader = new AnnotationReader(csn.definitions, [
        '@share'
    ]);
    
    const csnAnnotationReader = new AnnotationReader(csn.definitions, [
        '@csn'
    ]);
    
    const context = { 
        csn, 
        appConfig, 
        annotationReader,
        transformerAnnotationReader,
        shareAnnotationReader,
        csnAnnotationReader
    };
    
    const dataProducts = processor.process(context);
    
    for (const config of dataProducts) {
        // Prefer namespace from processed config; fallback to appConfig or default
        const namespace = config.namespace
                          || appConfig?.ordNamespace
                          || 'default';
        const version = config.version || '1.0.0';
        const name = config.name || config.serviceName;
        
        const baseConfig = {
            ...config,
            namespace,
            version,
            name
        };
        
        const dpd = await buildDpdObject(baseConfig, csn, appConfig);
        files.push({
            path: `${namespace.replace(/\./g, '/')}/dataproducts/${name}_${version}.json`,
            content: JSON.stringify(dpd, null, 2)
        });
        
        const transformer = buildTransformerObject(baseConfig, csn, appConfig);
        files.push({
            path: `${namespace.replace(/\./g, '/')}/transformer/${name}_${version}.json`,
            content: JSON.stringify(transformer, null, 2)
        });
        
        const share = buildShareObject(baseConfig, csn, appConfig);
        files.push({
            path: `${namespace.replace(/\./g, '/')}/share/${name}_${version}.json`,
            content: JSON.stringify(share, null, 2)
        });
        
        const modifiedCsn = buildCsnObject(baseConfig, csn, appConfig);
        files.push({
            path: `${namespace.replace(/\./g, '/')}/csn_documents/${name}_${version}.json`,
            content: JSON.stringify(modifiedCsn, null, 2)
        });
        
        Logger.info(`Generated all files for data product: ${name}`);
    }
    
    return files;
}

module.exports = {
    generateDataProductFiles
};
