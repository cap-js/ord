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
    const cdsFileName = Object.values(cds.services).filter(
        (srv) =>
            srv.definition &&
            srv.definition.kind === "service" &&
            serviceName === srv.definition.name
    );
    const sourcePath = cdsFileName[0].definition["@source"];
    const compilerFunction = {
        edmx: {
            function: "edmx-v4",
            contentType: "application/xml",
        },
        asyncapi2: {
            function: "asyncapi",
            contentType: "application/json",
        },
        oas3: {
            function: "openapi",
            contentType: "application/json",
        },
    };
    let responseFile; 
    const csn = await cds.compile(`file:${sourcePath}`);
    const options = { service: cdsFileName[0].name, as: 'str', messages: [] }
    if (compilerType === "oas3") {
        responseFile = openapi(csn, options);
    } else if (compilerType === "asyncapi2") {
        responseFile = asyncapi(csn, options);
    } else if (compilerType === "edmx") {
        responseFile = await cds.compile(csn).to["edmx-v4"](options);
    }
    return {
        contentType: compilerFunction[compilerType].contentType,
        response: responseFile
    };
}
