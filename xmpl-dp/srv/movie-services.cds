using { sap.cds.demo as demo } from '../db/schema';
using { sap.capire.incidents as incidents } from '../db/incidents-schema';
using { sap.capire.entertainment as entertainment } from '../db/cinema-extended';

/**
 * Service 1: Movie Database - Primary Data Product
 * Tests: Core annotations (namespace, name, version, title, description, etc.)
 */
@title: 'Movie Database Core'
@DataIntegration.dataProduct.type: 'primary'
@namespace: 'com.movies.database'
@name: 'MovieDB'
@version: '1.0.0'
@description: 'Core movie database with actors, directors, and movie information'
@shortDescription: 'Movie database'
@visibility: 'internal'
@category: 'ENTERTAINMENT'
@partOfPackage: 'com.movies.core'
@responsible: 'Content Team'
@releaseStatus: 'active'
service MovieDatabase {
    entity Movies as projection on demo.Movie;
    entity Directors as projection on entertainment.Director;
    entity Actors as projection on entertainment.Actor;
    entity MovieCast as projection on entertainment.MovieCast;
    entity Genres as projection on entertainment.Genre;
    entity MovieGenres as projection on entertainment.MovieGenre;
}

/**
 * Service 2: Theater Network - Tests Share Configuration
 * Tests: All @share annotations including extensibility, rate limiting, access control
 */
@title: 'Theater Network Service'
@DataIntegration.dataProduct.type: 'primary'
@namespace: 'com.cinema.theaters'
@name: 'TheaterNetwork'
@version: '2.0.0'
@visibility: 'public'
@category: 'VENUES'
@responsible: 'Theater Operations'
@share.isRuntimeExtensible: true
@share.includeEntities: ['Theaters', 'Screens', 'Showtimes']
@share.excludeEntities: ['maintenanceSchedule']
@share.columnMapping.maintenanceSchedule: 'HIDDEN'
@share.columnMapping.salary: 'MASKED'
@share.typeMapping.UUID: 'String'
@share.typeMapping.DateTime: 'String'
@share.includeManaged: false
@share.includeVirtual: true
@share.includeComputed: true
@share.extensible.supported: true
@share.extensible.description: 'Partners can add custom theater attributes'
@share.dataClassification: 'public'
@share.accessControl: 'api-key'
@share.rateLimiting.requestsPerMinute: 500
@share.rateLimiting.requestsPerDay: 50000
service TheaterService {
    entity Theaters as projection on entertainment.Theater;
    entity Screens as projection on entertainment.Screen;
    entity Showtimes as projection on entertainment.Showtime;
}

/**
 * Service 3: Movie Analytics - Derived with Transformer
 * Tests: All @transformer annotations including Spark configuration
 */
@title: 'Movie Analytics Platform'
@DataIntegration.dataProduct.type: 'derived'
@namespace: 'com.movies.analytics'
@name: 'MovieAnalytics'
@version: '1.0.0'
@description: 'Analytics on movie performance, ratings, and trends'
@category: 'ANALYTICS'
@responsible: 'Data Science Team'
@dataProducts: ['com.movies.database:MovieDB:1.0.0', 'com.cinema.theaters:TheaterNetwork:2.0.0']
@transformer.name: 'MovieTrendsAnalyzer'
@transformer.dpdType: 'analytical'
@transformer.dpdVersion: '1.0.0'
@transformer.stepKey: 'movies.analytics.trends'
@transformer.application: 'MovieBI'
@transformer.package: 'com.movies.analytics'
@transformer.packageVersion: '1.0.0'
@transformer.entrypoint: 'com.movies.analytics.TrendProcessor'
@transformer.parameters.analysisType: 'trending'
@transformer.parameters.timeWindow: '7d'
@transformer.parameters.metrics: ['views', 'ratings', 'revenue']
@transformer.parameters.outputFormat: 'json'
@transformer.sparkVersion: '3.5.0'
@transformer.driverMemory: '1g'
@transformer.executorMemory: '2g'
@transformer.cronSchedule: '0 */6 * * *'
@transformer.packages: ['org.apache.spark:spark-sql_2.12:3.5.0', 'io.delta:delta-core_2.12:2.4.0']
@industry: ['Entertainment', 'Media', 'Streaming']
@lineOfBusiness: ['Content Analytics', 'Market Research']
@countries: ['US', 'UK', 'CA', 'AU', 'NZ']
@tags: ['analytics', 'trends', 'box-office', 'ratings', 'performance']
service MovieAnalytics {
    entity MovieTrends as projection on entertainment.MovieTrends;
    entity ActorPopularity as projection on entertainment.ActorPopularity;
    entity TopRatedMovies as projection on demo.Movie;
    entity Reviews as projection on entertainment.Review;
    entity Ratings as projection on entertainment.Rating;
}

/**
 * Service 4: Public API - Tests Lifecycle and Taxonomy
 * Tests: @lifecycle, @taxonomy, deprecation dates
 */
@title: 'Movies Public API'
@DataIntegration.dataProduct.type: 'derived'
@namespace: 'com.movies.api'
@name: 'MoviesAPI'
@version: '3.0.0'
@description: 'Public API for movie information, ratings, and reviews'
@shortDescription: 'Public movie API'
@visibility: 'public'
@category: 'API'
@partOfPackage: 'com.movies.public'
@responsible: 'API Team'
@releaseStatus: 'active'
@dataProducts: ['com.movies.database:MovieDB:1.0.0']
@lifecycle.status: 'active'
@lifecycle.retentionPeriod: '5y'
@lifecycle.archivalPolicy: 'archive-completed'
@lifecycle.auditTrail: true
@taxonomy.regulatoryDomains: ['COPYRIGHT', 'CONTENT', 'PRIVACY']
@taxonomy.jurisdictions: ['US', 'EU', 'APAC']
@taxonomy.complianceStandards: ['ISO27001', 'REST-API-v3', 'OWASP']
@deprecationDate: '2025-12-31'
@sunsetDate: '2026-06-30'
@lastUpdate: '2024-01-20'
service MoviesPublicAPI {
    @readonly
    entity Movies as projection on demo.Movie;
    
    @readonly
    entity Actors as projection on entertainment.Actor {
        ID,
        name,
        birthDate,
        country,
        age,
        biography,
        awards,
        popularity
        // excluding salary (masked field)
    };
    
    @readonly
    entity Directors as projection on entertainment.Director;
    
    entity Reviews as projection on entertainment.Review;
    entity Ratings as projection on entertainment.Rating;
    
    @readonly
    entity Genres as projection on entertainment.Genre;
}

/**
 * Additional annotations for existing entities to test entity-level annotations
 */

// Enhance Movie entity
annotate demo.Movie with @(
    EntityRelationship.entityIds: ['ID'],
    EntityRelationship.reference: 'imdb.database:Movie'
);

// Enhance Director entity  
annotate entertainment.Director with @(
    ODM.entityName: 'Director',
    EntityRelationship.entityType: 'entertainment.person:Director',
    ObjectModel.tenantWideUniqueName: 'movies.Director'
);

// Enhance Actor entity
annotate entertainment.Actor with @(
    ODM.entityName: 'Actor',
    EntityRelationship.entityType: 'entertainment.person:Actor'
);

// Enhance Theater entity (already has annotations in cinema-extended.cds)
annotate entertainment.Theater with @(
    ODM.oid: 'ID'
);