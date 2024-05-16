'use strict';
const { ord, getMetaData, defaults } = require('./lib');

// function ORDMetadataService() {
//     srv.on('getORDMetadata', async () => {
//         const { contentType, response } = await getMetaData(req.url);
//         return JSON.stringify(response);
//     });
// }

// function ORDDocumentService() {
//     this.on('getORDDocument', () => {
//         const ordDoc = ord();
//         return JSON.stringify(ordDoc);
//     });
// }

// module.exports = {
//     ORDMetadataService,
//     ORDDocumentService
// };

module.exports = function (srv) {
    srv.on('getORDMetadata', async () => {
        const { contentType, response } = await getMetaData(req.url);
        return JSON.stringify(response);
    });

    srv.on('getORDDocument', () => {
        const ordDoc = ord();
        return JSON.stringify(ordDoc);
    });
} 