const cds = require('@sap/cds')

class OrdService extends cds.ApplicationService {
  /** Registering custom event handlers */
  init() {
    this.before('READ', '*', console.log('hi'))
    return super.init()
  }




}

module.exports = { OrdService }


// ------------------------------------------------------------------------------------------------------------------------------------------------------------
// For demo purposess only...
const _require = id => {try{ return require(id) } catch(e) { if (e.code !== 'MODULE_NOT_FOUND') throw e }}
cds.once("served", ()=> _require('./alert-notifications')?.prototype.init.call(cds.services.OrdService))
