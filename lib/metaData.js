const path = require("path");
const cds = require("@sap/cds/lib");
const assert = require("node:assert");
const cdsc = require("@sap/cds-compiler/lib/main");
const { compile: openapi } = require("@cap-js/openapi");
const { compile: asyncapi } = require("@cap-js/asyncapi");

const Logger = require("./logger");
const { interopCSN } = require("./interopCsn.js");
const { COMPILER_TYPES, OPENAPI_SERVERS_ANNOTATION } = require("./constants");

function extractServiceName(url) {
    return path.basename(url, ".json").split(".").slice(0, -1).join(".");
}

function extractCompilerType(url) {
    return path.basename(url, ".json").split(".").pop();
}

const compilers = Object.freeze({
    [COMPILER_TYPES.csn]: async function (csn, options) {
        return {
            contentType: "application/json",
            response: interopCSN(
                cdsc.for.effective(csn, { beta: { effectiveCsn: true }, effectiveServiceName: options.service }),
            ),
        };
    },
    [COMPILER_TYPES.mcp]: async function (csn, options) {
        return {
            contentType: "application/json",
            response: await cds.compile(csn).to["mcp"]({ ...options, ...(cds.env.ord?.compileOptions?.mcp || {}) }),
        };
    },
    [COMPILER_TYPES.oas3]: async function (csn, options) {
        // Check for service-level @OpenAPI.servers annotation
        const servers = csn?.definitions?.[options.service]?.[OPENAPI_SERVERS_ANNOTATION];
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
    [COMPILER_TYPES.edmx]: async function (csn, options) {
        return {
            contentType: "application/xml",
            response: await cds
                .compile(csn)
                .to["edmx"]({ ...options, ...(cds.env?.ord?.compileOptions?.edmx || {}) }),
        };
    },
    [COMPILER_TYPES.graphql]: async function (csn, options) {
        const { generateSchema4 } = require("@cap-js/graphql/lib/schema");
        const { printSchema, lexicographicSortSchema } = require("graphql");
        const srv = new cds.ApplicationService(options.service, cds.linked(csn));

        return {
            contentType: "text/plain",
            response: printSchema(lexicographicSortSchema(generateSchema4({ [options.service]: srv }))),
        };
    },
    [COMPILER_TYPES.asyncapi2]: async function (csn, options) {
        return {
            contentType: "application/json",
            response: asyncapi(csn, { ...options, ...(cds.env?.ord?.compileOptions?.asyncapi || {}) }),
        };
    },
});

const getMetadata = async (url, model = null) => {
    const serviceName = extractServiceName(url);
    const compilerType = extractCompilerType(url);
    const csn = model || cds.services[serviceName]?.model;
    const options = { service: serviceName, as: "str", messages: [] };

    assert(Object.hasOwn(compilers, compilerType), `Unsupported format: ${compilerType}`);

    return await compilers[compilerType](csn, options).catch((error) => {
        Logger.error(`Compilation failed for service ${serviceName} (compiler: ${compilerType}) - ${error.message}`);
        throw error;
    });
};

module.exports = getMetadata;
