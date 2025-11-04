using { ord.integration as db } from '../db/schema';

service IntegrationTestService {
  entity Pings as projection on db.Pings;
}
