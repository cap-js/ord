const cds = require('@sap/cds')

class OrdService extends cds.ApplicationService {
  /** Registering custom event handlers */
  init() {
    this.on('GET', '*', console.log('hi'))
    return super.init()
  }

}

module.exports = { OrdService }
