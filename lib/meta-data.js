const path = require("path");
const cds = require("@sap/cds/lib");
const assert = require("node:assert");
const cdsc = require("@sap/cds-compiler/lib/main");
const { compile: openapi } = require("@cap-js/openapi");
const { compile: asyncapi } = require("@cap-js/asyncapi");

const Logger = require("./logger");
const { interopCSN } = require("./interop-csn.js");

const COMPILERS = Object.freeze({
    csn: function (csn, options) {
        return {
            contentType: "application/json",
            response: interopCSN(
                cdsc.for.effective(csn, { beta: { effectiveCsn: true }, effectiveServiceName: options.service }),
            ),
        };
    },
    mcp: async function (csn, options) {
        return {
            contentType: "application/json",
            response: cds.compile(csn).to["mcp"]({ ...options, ...(cds.env.ord?.compileOptions?.mcp || {}) }),
        };
    },
    oas3: function (csn, options) {
        // Check for service-level @OpenAPI.servers annotation
        const servers = csn?.definitions?.[options.service]?.["@OpenAPI.servers"];
        const openapiOptions = { ...options, ...(cds.env?.ord?.compileOptions?.openapi || {}) };

        // Service-level annotation takes precedence over global config
        if (Array.isArray(servers) && servers.length) {
            openapiOptions["openapi:servers"] = JSON.stringify(servers);
        }

        return {
            contentType: "application/json",
            response: openapi(csn, openapiOptions),
        };
    },
    edmx: function (csn, options) {
        return {
            contentType: "application/xml",
            response: cds.compile(csn).to["edmx"]({ ...options, ...(cds.env?.ord?.compileOptions?.edmx || {}) }),
        };
    },
    graphql: function (csn, options) {
        const { generateSchema4 } = require("@cap-js/graphql/lib/schema");
        const { printSchema, lexicographicSortSchema } = require("graphql");
        const srv = new cds.ApplicationService(options.service, cds.linked(csn));

        return {
            contentType: "text/plain",
            response: printSchema(lexicographicSortSchema(generateSchema4({ [options.service]: srv }))),
        };
    },
    asyncapi2: function (csn, options) {
        return {
            contentType: "application/json",
            response: asyncapi(csn, { ...options, ...(cds.env?.ord?.compileOptions?.asyncapi || {}) }),
        };
    },
});

module.exports = async (url, model = null) => {
    const type = path.basename(url, ".json").split(".").pop();
    const name = path.basename(url, ".json").split(".").slice(0, -1).join(".");

    assert(Object.hasOwn(COMPILERS, type), `Unsupported format: ${type}`);

    try {
        return await COMPILERS[type](model ?? cds.services[name]?.model, { service: name, as: "str", messages: [] });
    } catch (error) {
        Logger.error(`Compilation failed for service ${name} (compiler: ${type}) - ${error.message}`);
        throw error;
    }
};
