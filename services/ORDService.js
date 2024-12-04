const cds = require('@sap/cds');
const { ord } = require('../lib'); // Adjust paths as necessary
const { Logger } = require('../lib/logger');


module.exports = async (srv) => {
        srv.on('READ', async (req) => {
            if (req.path === '/open-resource-discovery/v1/documents/1') {
                try {
                    // Load the service definitions (CSN) and generate ORD data
                    const csn = await cds.load(cds.env.folders.srv);
                    const data = ord(csn);

                    return data; // CAP will automatically format and send this response
                } catch (error) {
                    Logger.error(error, 'Error while creating ORD document');
                    req.error(500, 'Failed to create ORD document');
                }
            }
        });



};