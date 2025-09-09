/**
 * Central default configuration for Data Product generation
 * These defaults can be overridden by:
 * 1. Service-specific annotations (highest priority)
 * 2. Environment variables
 * 3. These defaults (lowest priority)
 */

module.exports = {
    // Transformer defaults
    transformer: {
        dpdType: process.env.DPD_TRANSFORMER_TYPE || "sap.fos.transformer",
        dpdVersion: process.env.DPD_TRANSFORMER_VERSION || "v2",
        vendor: process.env.DPD_TRANSFORMER_VENDOR || "",
        partOfProducts: process.env.DPD_TRANSFORMER_PART_OF_PRODUCTS 
            ? process.env.DPD_TRANSFORMER_PART_OF_PRODUCTS.split(',') 
            : [],
        application: process.env.DPD_TRANSFORMER_APPLICATION || "cdl-spark",
        stepKey: process.env.DPD_TRANSFORMER_STEP_KEY || "cds.transform.TransformationGraph",
        packageName: process.env.DPD_TRANSFORMER_PACKAGE_NAME || "com.sap.cds-feature-attachments",
        packageVersion: process.env.DPD_TRANSFORMER_PACKAGE_VERSION || "3.1.3",
        entryPoint: process.env.DPD_TRANSFORMER_ENTRY_POINT || "cds.transform.TransformationGraph",
        cronSchedule: process.env.DPD_TRANSFORMER_CRON_SCHEDULE || "* * * * */2 0 0",
        spark: {
            version: process.env.DPD_SPARK_VERSION || "3.5.0",
            packages: process.env.DPD_SPARK_PACKAGES 
                ? process.env.DPD_SPARK_PACKAGES.split(',') 
                : ["com.sap.cds-feature-attachments:cdl-spark:3.1.3"],
            driverMemory: process.env.DPD_SPARK_DRIVER_MEMORY || "2g",
            executorMemory: process.env.DPD_SPARK_EXECUTOR_MEMORY || "2g"
        }
    },
    
    // Share defaults
    share: {
        extensible: {
            supported: process.env.DPD_SHARE_EXTENSIBLE_SUPPORTED || "automatic",
            description: process.env.DPD_SHARE_EXTENSIBLE_DESCRIPTION || 
                "API can be extended by custom fields on the following business contexts"
        },
        isRuntimeExtensible: process.env.DPD_SHARE_RUNTIME_EXTENSIBLE !== "false", // default true
        includeManaged: process.env.DPD_SHARE_INCLUDE_MANAGED !== "false", // default true
        includeVirtual: process.env.DPD_SHARE_INCLUDE_VIRTUAL === "true", // default false
        includeComputed: process.env.DPD_SHARE_INCLUDE_COMPUTED === "true" // default false
    },
    
    // CSN defaults
    csn: {
        formatVersion: process.env.DPD_CSN_FORMAT_VERSION || "1.0",
        id: process.env.DPD_CSN_ID || "id",
        creator: process.env.DPD_CSN_CREATOR || "CAP",
        includeMetadata: process.env.DPD_CSN_INCLUDE_METADATA !== "false", // default true
        includeAnnotations: process.env.DPD_CSN_INCLUDE_ANNOTATIONS !== "false", // default true
        includeAbstract: process.env.DPD_CSN_INCLUDE_ABSTRACT !== "false", // default true
        includePrivate: process.env.DPD_CSN_INCLUDE_PRIVATE === "true", // default false
        pruneUnused: process.env.DPD_CSN_PRUNE_UNUSED === "true", // default false
        flattenAssociations: process.env.DPD_CSN_FLATTEN_ASSOCIATIONS === "true", // default false
        expandStructures: process.env.DPD_CSN_EXPAND_STRUCTURES === "true" // default false
    },
    
    // DPD (Data Product Definition) defaults
    dpd: {
        type: process.env.DPD_DEFAULT_TYPE || "primary",
        visibility: process.env.DPD_DEFAULT_VISIBILITY || "internal",
        version: process.env.DPD_DEFAULT_VERSION || "1.0.0",
        releaseStatus: process.env.DPD_DEFAULT_RELEASE_STATUS || "active"
    },
    
    // Type mappings for share files
    typeMapping: {
        'cds.String': 'string',
        'cds.LargeString': 'string',
        'cds.Integer': 'integer',
        'cds.Integer32': 'integer',
        'cds.Integer64': 'long',
        'cds.Decimal': 'decimal',
        'cds.Double': 'double',
        'cds.Boolean': 'boolean',
        'cds.Date': 'date',
        'cds.DateTime': 'timestamp',
        'cds.Timestamp': 'timestamp',
        'cds.Time': 'time',
        'cds.UUID': 'string',
        'cds.Binary': 'binary',
        'cds.LargeBinary': 'binary'
    }
};
