@cds.dp.ordId: 'test.sai:apiResource:Supplier:v1'
@cds.external: true
@data.product: true
@protocol    : 'none'
service test.sai.Supplier.v1 {
  entity Supplier {
    key ID   : String(10);
        name : String(80);
  };
};
