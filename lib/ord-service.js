import cds from '@sap/cds'

// todo fix issue
// only supports es modules imports but
// https://cap.cloud.sap/docs/releases/changelog/2022#jul-22-changed
// [cds@6.0.1] Plugins cannot be loaded as ES modules, but need to remain CommonJS modules

// related steps
// 1) use es modules syntax
// 2.a) use .mjs extension
// 2.b) use type: module in package.json


export class OrdService extends cds.ApplicationService {
    example() {
        console.log('example')
    }

    init(){

        this.on('READ','documents', req => {
            console.log('READ documents')
            return 'documents'
        })


        this.on('READ','csn', req => {
            console.log('READ csn')
            return 'csn'
        })

        this.on('api', req => {
            let csn = cds.context?.model || cds.model
            let { service, arg } = req.data
            return 'data'
        })

        /**
         * Middleware to handle the request for the API
         */
        cds.app.get (`${this.path}/:api?/:service?`, cds.middlewares.before, async (req, res, next) => {
            const { api, service } = req.params
            const resolvedValue = await this.api (service, api)
            console.log('resolvedValue', resolvedValue)
            if (resolvedValue) {
                res.status(200).send(resolvedValue)
            } else {
                next()
            }
        })

        return super.init()
    }
}

export class WellKnownService extends cds.ApplicationService {
    init() {

        this.on('ord', req => {
            let { res } = req.http
            return res.send('test')
        })

        cds.app.get (`${this.path}`, cds.middlewares.before, req => {
            return this.ord()
        })
        return super.init()
    }
}
