using { cuid, managed } from '@sap/cds/common';
using { sap.cds.demo as demo } from './schema';
using { sap.capire.incidents as incidents } from './incidents-schema';

namespace sap.capire.entertainment;

/**
 * People in the movie industry
 */
entity Director : managed {
    key ID : UUID;
    name : String(100);
    birthDate : Date;
    country : String(50);
    @Core.Computed
    age : Integer;
    biography : String(1000);
    awards : array of String;
    @readonly
    totalMovies : Integer;
}

entity Actor : managed {
    key ID : UUID;
    name : String(100);
    birthDate : Date;
    country : String(50);
    @Core.Computed
    age : Integer;
    biography : String(1000);
    @mask
    salary : Decimal(15,2);
    awards : array of String;
    @virtual
    popularity : Integer;
}

entity MovieCast : cuid {
    movie : Association to demo.Movie;
    actor : Association to Actor;
    role : String(100);
    @EntityRelationship.entityIds: ['movie', 'actor']
    isMainRole : Boolean;
    screenTime : Integer;
}

/**
 * Theater and screening locations
 */
@ODM.root: true
@ODM.entityName: 'Theater'
@EntityRelationship.entityType: 'entertainment.venue:Theater'
entity Theater : managed {
    key ID : UUID;
    name : String(100);
    city : String(50);
    address : String(200);
    @EntityRelationship.reference: 'maps.service:Location'
    coordinates : String;
    totalScreens : Integer;
}

entity Screen : cuid {
    theater : Association to Theater;
    screenNumber : Integer;
    capacity : Integer;
    @private
    maintenanceSchedule : String;
    features : array of String;
}

@EntityRelationship.compositeReferences: [{
    entity: 'ticketing.system:ShowEvent',
    keys: ['theater', 'startTime']
}]
entity Showtime : cuid, managed {
    movie : Association to demo.Movie;
    theater : Association to Theater;
    screen : Association to Screen;
    startTime : DateTime;
    @Core.Computed
    endTime : DateTime;
    language : String(10);
    subtitles : Boolean;
}

/**
 * Ratings and reviews
 */
@ObjectModel.tenantWideUniqueName: 'entertainment.ratings.MovieRating'
entity Rating : cuid {
    movie : Association to demo.Movie;
    customer : Association to incidents.Customers;
    stars : Integer;
    @readonly
    ratedOn : DateTime;
}

@EntityRelationship.propertyType: 'content.review.user'
entity Review : cuid {
    movie : Association to demo.Movie;
    reviewer : Association to incidents.Customers;
    title : String(100);
    content : String(1000);
    @Core.Computed
    helpfulCount : Integer;
    @readonly
    postedOn : DateTime;
}

/**
 * Genres and categories
 */
entity Genre {
    key code : String(20);
    name : String(50);
    description : String(200);
    @virtual
    movieCount : Integer;
}

entity MovieGenre {
    key movie : Association to demo.Movie;
    key genre : Association to Genre;
    isPrimary : Boolean;
}

/**
 * Analytics entities for aggregated data
 */
entity MovieTrends : managed {
    key period : String(7);
    key movie : Association to demo.Movie;
    totalViews : Integer;
    avgRating : Decimal(3,2);
    revenue : Decimal(15,2);
    @Core.Computed
    trendScore : Integer;
}

entity ActorPopularity : managed {
    key period : String(7);
    key actor : Association to Actor;
    movieCount : Integer;
    avgMovieRating : Decimal(3,2);
    socialMediaFollowers : Integer;
    @Core.Computed
    popularityIndex : Integer;
}