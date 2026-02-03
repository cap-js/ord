using {sap.capire.bookshop as my} from '../db/schema';

@data.product

service sap.capdpprod.DPBooks.v1 {

  entity Books   as projection on my.Books;
  entity Authors as projection on my.Authors;

// @assert.unique.ab: [
//   a,
//   b
// ]
// @assert.unique.bc: [
//   b,
//   c
// ]
// entity Fake1 {
//   key id : Integer;
//       a  : Integer;
//       b  : Integer;
//       c  : Integer;
// }

}
