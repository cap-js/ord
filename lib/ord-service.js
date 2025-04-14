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
    init(){

        this.on('READ','documents', req => {
            console.log('READ documents', req)
            let csn = cds.context?.model || cds.model
            return { ord: csn }
        })


        this.on('READ','csn', req => {
            console.log('READ csn', req)
            let csn = cds.context?.model || cds.model
            let { id } = req.data
            if (id) csn = csn.definitions[id] || 'not in model!'
            return { id, csn }
        })

        this.on('api', req => {
            console.log('READ api', req)
            let csn = cds.context?.model || cds.model
            console.log('Model',csn)
            let { service, format = 'csn' } = req.data
            console.log('format',format)
            console.log('service',service)
            let { res } = req.http
            if (format === 'csn') {
                if (!service) return res.send(csn)
                service = csn.services[service]
                return res.send({ definitions: [ service, ...service.entities ] .reduce ((all,e) => {
                        let d = all[e.name] = {...e}
                        delete d.projection // not part of the API
                        delete d.query     // not part of the API
                        return all
                    },{})})
            }
            let api = cds.compile(csn).to[format]({service})
            return res.send(api)
        })

        /**
         * Example how to register arbitrary express routes,
         * and map them to our service's interface.
         * Try it out with URLs like that:
         *
         * - http://localhost:4004/ord/v1/csn/CatalogService
         * - http://localhost:4004/ord/v1/edmx/CatalogService
         * - http://localhost:4004/ord/v1/openapi/CatalogService
         * - http://localhost:4004/ord/v1/asyncapi/CatalogService
         *
         * NOTE: we add cds.middlewares.before to the route, which gives us all
         * the context and auth handling, which is also available to CAP services.
         */
        cds.app.get (`${this.path}/:api?/:service?`, cds.middlewares.before, req => {
            let { res } = req.http
            return this.api (service, api)
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
