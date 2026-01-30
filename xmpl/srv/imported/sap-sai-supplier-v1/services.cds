@cds.dp.ordId : 'sap.sai:apiResource:Supplier:v1'
@cds.external : true
@data.product : true
@protocol : 'none'
service sap.sai.Supplier.v1 {
  entity Supplier {
    key ID : String(10);
    name : String(80);
  };
};
