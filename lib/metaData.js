/**
 * Retrieves the compiled meta data for the specific service or event according to its compiled type
 * @param {string} data 
 * @returns {string, JSON|XML} contentType, response 
 */
const cds = require('@sap/cds/lib');
const { compile : openapi } = require('@cap-js/openapi')
const { compile : asyncapi } = require('@cap-js/asyncapi');

module.exports = async (data) => {
    const parts = data?.split("/").pop().replace(/\.json$/, '').split(".");
    const compilerType = parts.pop();
    const serviceName = parts.join(".");
    const csn = cds.services[serviceName].model

    let responseFile; 
    const options = { service: serviceName, as: 'str', messages: [] }
    if (compilerType === "oas3") {
        try {
            responseFile = openapi(csn, options);
        } catch (error) {
            console.error("OpenApi error:", error.message);
            throw error;
        }
    } else if (compilerType === "asyncapi2") {
        try {
            responseFile = asyncapi(csn, options);
        } catch (error) {
            console.error("AsyncApi error:", error.message);
            throw error;
        }
    } else if (compilerType === "edmx") {
        try {
            responseFile = await cds.compile(csn).to["edmx-v4"](options);
        } catch (error) {
            console.error("Edmx error:", error.message);
            throw error;
        }
    }

    return {
        contentType: `application/${compilerType === "edmx" ? "xml" : "json"}`,
        response: responseFile
    };
}
