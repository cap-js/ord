using {sap.cds.demo as my} from '../db/schema';

namespace test.enhanced;

// Test service with all new annotations aligned with VS Code extension
@DataIntegration.dataProduct
@DataIntegration.dataProduct.type: 'derived'
@namespace: 'com.example.analytics'
@name: 'EnhancedAnalytics'
@version: '2.1.0'
@title: 'Enhanced Analytics Service'
@description: 'Comprehensive analytics service with all Schema v2 annotations'
@shortDescription: 'Analytics service for business insights'
@category: 'ANALYTICS'
@partOfPackage: 'com.example.analytics.suite'
@responsible: 'Analytics Team'
@releaseStatus: 'active'
@visibility: 'public'
// Define input dependencies for derived data product
@dataProducts: ['com.example.orders:OrderService:v1', 'com.example.customers:CustomerService:v1']
// Transformer configuration - all settings in one object
@transformer: {
    name: 'EnhancedAnalyticsTransformer',
    cronSchedule: '0 0 */2 * * * *',
    sparkVersion: '3.5.0',
    driverMemory: '4g',
    executorMemory: '8g',
    packages: [
        'com.sap.cds-feature-attachments:cdl-spark:3.1.3',
        'org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0'
    ],
    stepKey: 'analytics.transform.advanced',
    package: 'com.example.analytics',
    packageVersion: '2.1.0',
    entrypoint: 'com.example.analytics.Main',
    parameters: {
        inputPath: 's3://data-lake/raw/analytics',
        outputPath: 's3://data-lake/processed/analytics',
        format: 'parquet',
        partitionBy: 'date',
        mode: 'append',
        compressionCodec: 'snappy'
    }
}
// Share configuration
@share: {
    includeEntities: ['Metrics', 'Aggregations'],
    excludeEntities: ['InternalData'],
    includeVirtual: false,
    includeComputed: true,
    includeManaged: true
}
// Lifecycle management
@lifecycle: {
    status: 'active',
    deprecationDate: '2025-12-31',
    sunsetDate: '2026-06-30',
    successorId: 'com.example.analytics:EnhancedAnalytics:v3'
}
// Taxonomy classification
@taxonomy: {
    industryCodes: ['RETAIL', 'FINANCE', 'HEALTHCARE'],
    lineOfBusiness: ['Sales', 'Marketing', 'Operations'],
    countries: ['US', 'DE', 'JP', 'IN']
}
service EnhancedAnalyticsService {
    entity Metrics {
        key ID : UUID;
        date : Date;
        region : String(10);
        
        @title: 'Revenue Amount'
        revenue : Decimal(15, 2);
        
        @title: 'Customer Count'
        customerCount : Integer;
        
        @Core.Computed
        growthRate : Decimal(5, 2);
        
        virtual trend : String(10);
    }
    
    entity Aggregations {
        key ID : UUID;
        period : String(20);
        
        @title: 'Total Sales'
        totalSales : Decimal(18, 2);
        
        @Core.Computed
        averageOrderValue : Decimal(10, 2);
        
        virtual forecast : Decimal(15, 2);
    }
    
    @private
    entity InternalData {
        key ID : UUID;
        confidential : String(100);
    }
}

// Test service with minimal annotations to ensure backward compatibility
@DataIntegration.dataProduct
@title: 'Simple Service'
service SimpleService {
    entity BasicData as projection on my.Cinema;
}

// Test primary data product with Schema v2 annotations
@DataIntegration.dataProduct
@DataIntegration.dataProduct.type: 'primary'
@name: 'MasterData'
@version: '1.0.0'
@category: 'MASTER_DATA'
@partOfPackage: 'com.example.mdm'
@responsible: 'Master Data Team'
service MasterDataService {
    entity Products {
        key ID : UUID;
        name : String(100);
        
        @Core.Computed
        displayName : String(150);
    }
}