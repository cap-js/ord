const cds = require("@sap/cds");
const { ord, getMetadata, defaults, authentication, Logger } = require("./index.js");

class OpenResourceDiscoveryService extends cds.ApplicationService {
    init() {
        const logger = Logger.Logger;
        
        // Comprehensive debugging information
        logger.info('=== OpenResourceDiscoveryService.init() called ===');
        
        try {
            const cdsPackage = require('@sap/cds/package.json');
            logger.info(`CDS version: ${cdsPackage.version}`);
        } catch (err) {
            logger.warn(`Could not read CDS version: ${err.message}`);
        }
        
        logger.info(`Service path: ${this.path}`);
        logger.info(`Service name: ${this.name}`);
        logger.info(`cds.app exists: ${!!cds.app}`);
        logger.info(`cds.app type: ${typeof cds.app}`);
        
        if (cds.app) {
            logger.info(`cds.app constructor: ${cds.app.constructor.name}`);
            try {
                const prototype = Object.getPrototypeOf(cds.app);
                const methodNames = Object.getOwnPropertyNames(prototype).filter(name => {
                    try {
                        return typeof cds.app[name] === 'function';
                    } catch (e) {
                        return false;
                    }
                });
                logger.info(`cds.app methods: ${methodNames.join(', ')}`);
            } catch (err) {
                logger.warn(`Could not enumerate cds.app methods: ${err.message}`);
            }
        } else {
            logger.error('cds.app is undefined during service initialization');
            logger.info('Available cds properties:', Object.keys(cds).join(', '));
            logger.info('cds.env:', JSON.stringify(cds.env, null, 2));
            
            // Stack trace to understand call context  
            const stack = new Error().stack;
            logger.error('Initialization stack trace:', stack);
        }
        
        // Check if cds.app is actually an Express app (has .get method)
        const hasExpressApp = cds.app && typeof cds.app.get === 'function';
        logger.info(`cds.app has Express .get method: ${hasExpressApp}`);
        
        if (!hasExpressApp) {
            logger.error('Cannot register routes: cds.app is not an Express application or lacks .get method. Deferring route registration to served event.');
            
            // Register routes when Express app becomes available
            this._registerRoutesOnServed();
            return super.init();
        }
        
        logger.info('cds.app is a valid Express application, registering routes immediately...');
        this._registerRoutes();
        return super.init();
    }
    
    /**
     * Register routes when served event fires (cds.app guaranteed to exist)
     */
    _registerRoutesOnServed() {
        const logger = Logger.Logger;
        
        // Use a one-time listener to avoid duplicate registrations
        const onServed = () => {
            logger.info('=== Served event fired, attempting deferred route registration ===');
            logger.info(`cds.app exists in served event: ${!!cds.app}`);
            
            if (cds.app) {
                logger.info('Registering deferred Express routes...');
                this._registerRoutes();
            } else {
                logger.error('cds.app still undefined in served event');
            }
        };
        
        // Register one-time listener
        cds.once('served', onServed);
        logger.info('Registered one-time served event listener for route registration');
    }
    
    /**
     * Actually register the Express routes
     */
    _registerRoutes() {
        const logger = Logger.Logger;
        
        try {
            logger.info(`Registering route: GET ${this.path}`);
            cds.app.get(`${this.path}`, authentication.authenticate, (_, res) => {
                return res.status(200).send(defaults.baseTemplate);
            });

            logger.info('Registering route: GET /ord/v1/documents/ord-document');
            cds.app.get(`/ord/v1/documents/ord-document`, authentication.authenticate, async (_, res) => {
                const csn = cds.context?.model || cds.model;
                const data = ord(csn);
                return res.status(200).send(data);
            });

            logger.info('Registering route: GET /ord/v1/documents/:id');
            cds.app.get(`/ord/v1/documents/:id`, authentication.authenticate, async (_, res) => {
                return res.status(404).send("404 Not Found");
            });

            logger.info('Registering route: GET /ord/v1/:ordId?/:service?');
            cds.app.get(`/ord/v1/:ordId?/:service?`, authentication.authenticate, async (req, res) => {
                try {
                    const { contentType, response } = await getMetadata(req.url);
                    return res.status(200).contentType(contentType).send(response);
                } catch (error) {
                    logger.error(error, "Error while processing the resource definition document");
                    return res.status(500).send(error.message);
                }
            });
            
            logger.info('All ORD routes registered successfully');
        } catch (error) {
            logger.error(`Error registering routes: ${error.message}`);
            logger.error('Route registration stack:', error.stack);
        }
    }
}

module.exports = { OpenResourceDiscoveryService };
