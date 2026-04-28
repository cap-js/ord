@protocol: 'rest'
@requires: [ 'internal-user' ]
@path: '/-/cds/ord-provider-service'
@impl:'@cap-js/ord/lib/services/mtx-ord-provider-service.js'
service cds.xt.ord.MtxOrdProviderService {

  action getOrdDocument(
    tenant    : String,
    @cds.validate: false
    toggles   : array of String,
    for       : String enum { nodejs; java; },
  ) returns {};

  action getOrdResourceDefinition(
    tenant    : String,
    @cds.validate: false
    toggles   : array of String,
    for       : String enum { nodejs; java; },
    resource  : String,
  ) returns LargeString;
}
