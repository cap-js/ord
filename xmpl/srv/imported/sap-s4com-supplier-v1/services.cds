@cds.dp.ordId : 'sap.s4com:apiResource:Supplier:v1'
@cds.external : true
@data.product : true
@protocol : 'none'
service sap.s4com.Supplier.v1 {
  entity Supplier {
    key ID : String(10);
    name : String(80);
  };
};
