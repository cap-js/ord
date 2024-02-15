/**
 * Retrieves the compiled meta data for the specific service or event according to its compiled type
 * @param {string} data 
 * @returns {string, JSON|XML} contentType, response 
 */

module.exports = async (data) => {
    const [serviceName, compilerType] = data?.split("/").pop().split(".");
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
    const responseFile = await cds.compile(`file:${sourcePath}`)
        .to[compilerFunction[compilerType].function]({
            service: cdsFileName[0].name,
            to: compilerFunction[compilerType].function,
            as: 'str',
            messages: []
        });
    return {
        contentType: compilerFunction[compilerType].contentType,
        response: responseFile
    };
}
