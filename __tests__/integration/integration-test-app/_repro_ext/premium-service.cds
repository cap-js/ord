using {test.integration as my} from '../db/schema';

// A service that exists on instance A's model but NOT on instance B's model.
// Represents a service present in one load-balanced instance's composed/cached
// model but absent in another's (rolling deploy / divergent getCsn cache).
@odata
service PremiumService @(path: '/premium') {
    @readonly
    entity PremiumEntities as select from my.TestEntity;
}
