using {sap.cds.demo as my} from '../db/schema';

namespace test.annotations;

// Test 1: Correct organizational standard annotations
@title: 'Test Data Product with Direct Annotations'
@DataIntegration.dataProduct.type: 'primary'
service DirectAnnotationService {
    entity TestData as projection on my.Cinema;
}

// Test 2: Service with minimal required annotations
@title: 'Minimal Service Example'
@DataIntegration.dataProduct.type: 'primary'
service MinimalService {
    entity Items as projection on my.Movie;
}

// Test 3: Service with additional metadata
@title: 'Enhanced Service with Metadata'
@DataIntegration.dataProduct.type: 'derived'
service EnhancedService {
    entity Shows as projection on my.Show;
}