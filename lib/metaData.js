const cds = require('@sap/cds/lib');
const fs = require('fs');
const path = require('path');
const { compile : openapi } = require('@cap-js/openapi')
const { compile : asyncapi } = require('@cap-js/asyncapi');

/**
 * Retrieves the compiled meta data for the specific service or event according to its compiled type
 * @param {string} data 
 * @returns {string, JSON|XML} contentType, response 
 */
module.exports = async (data) => {
    const dynamicMetadata = !cds.env.ord?.dynamicMetadata && !cds.env.profiles.includes('production');
    const parts = data?.split("/").pop().replace(/\.json$/, '').split(".");
    const compilerType = parts.pop();
    const serviceName = parts.join(".");

    const csn = cds.services[serviceName].model;
    const filePathMap = {
        "oas3": path.join(cds.root, 'gen/srv/srv/ordResources/openapi', `${serviceName}.openapi.json`),
        "asyncapi2": path.join(cds.root, 'gen/srv/srv/ordResources/asyncapi', `${serviceName}.json`),
        "edmx": path.join(cds.root, 'gen/srv/srv/odata/v4', `${serviceName}.xml`)
    };

    try {
        if (dynamicMetadata) {
            return {
                contentType: `application/${compilerType === "edmx" ? "xml" : "json"}`,
                response: fs.readFileSync(filePathMap[compilerType])
            };
        } else {
            const options = { service: serviceName, as: 'str', messages: [] };
            let responseFile;
            switch (compilerType) {
                case "oas3":
                    responseFile = await openapi(csn, options);
                    break;
                case "asyncapi2":
                    responseFile = await asyncapi(csn, options);
                    break;
                case "edmx":
                    responseFile = await cds.compile(csn).to["edmx"](options);
                    break;
            }
            return {
                contentType: `application/${compilerType === "edmx" ? "xml" : "json"}`,
                response: responseFile
            };
        }
    } catch (error) {
        console.error(`${compilerType} error:`, error.message);
        throw error;
    }
};
