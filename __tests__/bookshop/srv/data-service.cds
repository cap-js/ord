using {sap.capire.bookshop as my} from '../db/schema';

@protocol: 'none'
@data.product
service DPBooks {

    entity Books as projection on my.Books;

}

