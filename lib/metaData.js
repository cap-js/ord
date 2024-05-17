const cds = require('@sap/cds/lib');
const { compile : openapi } = require('@cap-js/openapi')
const { compile : asyncapi } = require('@cap-js/asyncapi');

/**
 * Retrieves the compiled meta data for the specific service or event according to its compiled type
 * @param {string} data 
 * @returns {string, JSON|XML} contentType, response 
 */
module.exports = async (data) => {
    const parts = data?.split("/").pop().replace(/\.json$/, '').split(".");
    const compilerType = parts.pop();
    const serviceName = parts.join(".");
    const csn = cds.services[serviceName].model;

    let responseFile; 
    const options = { service: serviceName, as: 'str', messages: [] }
    if (compilerType === "oas3") {
        responseFile = openapi(csn, options);     
    } else if (compilerType === "asyncapi2") {
        responseFile = asyncapi(csn, options);
    } else if (compilerType === "edmx") {
        responseFile = await cds.compile(csn).to["edmx-v4"](options);
    }

    return {
        contentType: `application/${compilerType === "edmx" ? "xml" : "json"}`,
        response: responseFile
    };
}
