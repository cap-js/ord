import cds from '@sap/cds'
import {ord, getMetadata, defaults, authentication, logger} from './es-module.mjs'

export class OrdService extends cds.ApplicationService {
    /**
     * provides info for a specific ORD entry
     * @param req cds request object
     * @param res cds response object
     * @returns {Promise<*>} adjusted response
     */
    async ordEntry(req, res) {
        try {
            const { contentType, response } = await getMetadata(req.url);
            return res.status(200).contentType(contentType).send(response);
        } catch (error) {
            logger.Logger.error(error, 'Error while processing the resource definition document');
            return res.status(500).send(error.message);
        }
    }

    fixedPaths = ['documents']


    async init(){
        this.on('READ', 'documents', async (req) => {
            let { res } = req.http
            const csn = cds.context?.model || cds.model;
            const data = ord(csn);
            return res.status(200).send(data);
        })

        /**
         * Middleware to handle the request for the API
         */
        cds.app.get (`${this.path}/:api?/:service?`, authentication.authenticate, async (req, res, next) => {
            const { api, service } = req.params
            // revert to default behavior if no additional path is provided
            if (!api) {
                return next()
            }
            // to use CAP read api
            if (this.fixedPaths.includes(api)) {
                return next()
            }
            // to match http://localhost:4004/ord/v1/<ord-id>/<ord-file>
            if (service) {
                return this.ordEntry(req, res)
            } else {
                next()
            }
        })

        return super.init()
    }
}

export class OpenResourceDiscoveryService extends cds.ApplicationService {
    init() {
        cds.app.get (`${this.path}`, cds.middlewares.before, (_, res) => {
            return res.status(200).send(defaults.baseTemplate);
        })
        return super.init()
    }
}
