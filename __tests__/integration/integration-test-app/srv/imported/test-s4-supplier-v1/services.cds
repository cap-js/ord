@cds.dp.ordId: 'test.s4:apiResource:Supplier:v1'
@cds.external: true
@data.product: true
@protocol    : 'none'
service test.s4.Supplier.v1 {
  entity Supplier {
    key ID   : String(10);
        name : String(80);
  };
};
