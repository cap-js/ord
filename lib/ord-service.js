import cds from '@sap/cds'
import {ord, getMetadata, defaults, authentication, logger} from './es-module.mjs'

export class OrdService extends cds.ApplicationService {
    /**
     * provides json fro documents/ord-document
     * @param res cds response object
     * @returns {Promise<*>} adjusted response
     */
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


    async init(){
        /**
         * Middleware to handle the request for the API
         */
        cds.app.get (`${this.path}/:api?/:service?`, authentication.authenticate, async (req, res, next) => {
            const { api, service } = req.params
            if (!api) {
                return next()
            }
            if (api === 'documents') {
                return await this.ordDoc(res)
            }
            if (!service) {
                return next()
            }
            return this.ordEntry(req, res)
        })

        return super.init()
    }
}

export class WellKnownService extends cds.ApplicationService {
    init() {
        cds.app.get (`${this.path}`, cds.middlewares.before, (_, res) => {
            return res.status(200).send(defaults.baseTemplate);
        })
        return super.init()
    }
}
