using { service } from '@sap/cds';

service CatalogService {
  entity Books {
    key ID : Integer;
    title  : String;
    author : String;
  }
}
