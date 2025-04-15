import cds from '@sap/cds'
import {ord, getMetadata, defaults, authentication, logger} from './index-module.mjs'

// todo fix issue
// only supports es modules imports but
// https://cap.cloud.sap/docs/releases/changelog/2022#jul-22-changed
// [cds@6.0.1] Plugins cannot be loaded as ES modules, but need to remain CommonJS modules

// related steps
// 1) use es modules syntax
// 2.a) use .mjs extension
// 2.b) use type: module in package.json


export class OrdService extends cds.ApplicationService {
    async ordDoc(res) {
        try {
            const csn = cds.context?.model || cds.model;
            const data = ord(csn);
            return res.status(200).send(data);
        } catch (error) {
            logger.Logger.error(error, 'Error while creating ORD document');
            return res.status(500).send(error.message);
        }
    }

    async ordEntry(req, res) {
        try {
            const { contentType, response } = await getMetadata(req.url);
            return res.status(200).contentType(contentType).send(response);
        } catch (error) {
            Logger.error(error, 'Error while processing the resource definition document');
            return res.status(500).send(error.message);
        }
    }


    async init(){
        this.on('READ','documents', req => {
            console.log('READ documents')
            return 'documents'
        })


        this.on('READ','csn', req => {
            console.log('READ csn')
            return 'csn'
        })

        this.on('api', async req => {
            let csn = cds.context?.model || cds.model
            let { service, arg } = req.data
            return 'api'
        })

        /**
         * Middleware to handle the request for the API
         */
        cds.app.get (`${this.path}/:api?/:service?`, cds.middlewares.before, async (req, res, next) => {
            const { api, service } = req.params
            console.log('READ csn', service)
            console.log('READ csn', service)
            console.log('api', api)
            console.log('service', service)
            if (!api) {
                return res.status(404).send('No such service found')
            }
            if (api === 'documents') {
                return await this.ordDoc(res)
            }
            if (!service) {
                return res.status(404).send('No such service found')
            }
            return this.ordEntry(req, res)
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
