using {sap.capire.bookshop as my} from '../db/schema';

@protocol: 'none'
@data.product
service sap.capdpprod.DPBooks.v1 {

    entity Books as projection on my.Books;

}

