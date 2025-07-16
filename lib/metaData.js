const cds = require("@sap/cds/lib");
const { compile: openapi } = require("@cap-js/openapi");
const { compile: asyncapi } = require("@cap-js/asyncapi");
const { COMPILER_TYPES } = require("./constants");
const { Logger } = require("./logger");
const cdsc = require("@sap/cds-compiler/lib/main");

module.exports = async (url, model = null) => {
    const parts = url
        ?.split("/")
        .pop()
        .replace(/\.json$/, "")
        .split(".");
    const compilerType = parts.pop();
    const serviceName = parts.join(".");
    const csn = model || cds.services[serviceName]?.model;

    let responseFile;
    const options = { service: serviceName, as: "str", messages: [] };
    switch (compilerType) {
        case COMPILER_TYPES.oas3:
            try {
                if (serviceName === "OpenResourceDiscoveryService") {
                    responseFile = {};
                    break;
                }
                responseFile = openapi(csn, options);
            } catch (error) {
                Logger.error("OpenApi error:", error.message);
                throw error;
            }
            break;
        case COMPILER_TYPES.asyncapi2:
            try {
                responseFile = asyncapi(csn, options);
            } catch (error) {
                Logger.error("AsyncApi error:", error.message);
                throw error;
            }
            break;
        case COMPILER_TYPES.csn:
            try {
                const opt2 = { beta: { effectiveCsn: true }, effectiveServiceName: serviceName };
                responseFile = cdsc.for.effective(csn, opt2);
            } catch (error) {
                Logger.error("Csn error:", error.message);
                throw error;
            }
            break;
        case COMPILER_TYPES.edmx:
            try {
                responseFile = await cds.compile(csn).to["edmx"](options);
            } catch (error) {
                Logger.error("Edmx error:", error.message);
                throw error;
            }
    }
    return {
        contentType: `application/${compilerType === "edmx" ? "xml" : "json"}`,
        response: responseFile,
    };
};
