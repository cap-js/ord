using {sap.capire.bookshop as my} from '../db/schema';

@data.product

service sap.capdpprod.DPBooks.v1 {

    entity Books   as projection on my.Books;
    entity Authors as projection on my.Authors;
}
