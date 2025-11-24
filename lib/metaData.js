const cds = require("@sap/cds/lib");
const { compile: openapi } = require("@cap-js/openapi");
const { compile: asyncapi } = require("@cap-js/asyncapi");
const { COMPILER_TYPES } = require("./constants");
const { Logger } = require("./logger");
const { interopCSN } = require("./interopCsn.js");
const cdsc = require("@sap/cds-compiler/lib/main");

function isMCPPluginAvailable(resolveFunction = require.resolve) {
    try {
        resolveFunction("@btp-ai/mcp-plugin");
        console.log("MCP plugin is available");
        return true;
    } catch (error) {
        return false;
    }
}

const getMetadata = async (url, model = null) => {
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
                const opt_eff = { beta: { effectiveCsn: true }, effectiveServiceName: serviceName };
                let effCsn = cdsc.for.effective(csn, opt_eff);
                responseFile = interopCSN(effCsn);
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
            break;
        case COMPILER_TYPES.mcp:
            try {
                if (isMCPPluginAvailable()) {
                    const { buildMcpServerDefinitionByService } = require("@btp-ai/mcp-plugin/lib/utils/metadata");
                    // Get all available CDS services
                    const allServices = Object.values(cds.services);
                    // Generate metadata from runtime services
                    responseFile = await buildMcpServerDefinitionByService(allServices);
                } else {
                    throw new Error("MCP plugin not available");
                }
            } catch (error) {
                Logger.error("MCP server definition error:", error.message);
                throw error;
            }
            break;
    }
    return {
        contentType: `application/${compilerType === "edmx" ? "xml" : "json"}`,
        response: responseFile,
    };
};

module.exports = getMetadata;
module.exports.isMCPPluginAvailable = isMCPPluginAvailable;
