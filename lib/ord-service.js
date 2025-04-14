import cds from '@sap/cds'
const defaults = import('./defaults')


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
            console.log(defaults)
            let csn = cds.context?.model || cds.model
            let { service, format = 'csn' } = req.data
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
            const { api, service } = req.params
            return this.api (service, api)
        })

        return super.init()
    }
}

/**
 app.use("/.well-known/open-resource-discovery", async (req, res) => {
 res.status(200).send(defaults.baseTemplate);
 });

     // example: http://localhost:4004/ord/v1/documents/ord-document
 // ORD documents route: /ord/v1/documents/:documentName
 app.get("/ord/v1/documents/:documentName", authenticate, async (_, res) => {
 try {
 const csn = cds.context?.model || cds.model;
 const data = ord(csn);
 return res.status(200).send(data);
 } catch (error) {
 Logger.error(error, 'Error while creating ORD document');
 return res.status(500).send(error.message);
 }
 });

     // example: http://localhost:4004/ord/v1/sap.sample:apiResource:manualImplementedService:v1/AdminService.oas3.json
 // Resource Definition documents route: /ord/v1/:ordId/:fileName
 app.get("/ord/v1/:ordId/:fileName", authenticate, async (req, res) => {
 try {
 const { contentType, response } = await getMetadata(req.url);
 return res.status(200).contentType(contentType).send(response);
 } catch (error) {
 Logger.error(error, 'Error while processing the resource definition document');
 return res.status(500).send(error.message);
 }
 });
 */