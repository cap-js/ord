const cds = require("@sap/cds/lib");
const { compile: openapi } = require("@cap-js/openapi");
const { compile: asyncapi } = require("@cap-js/asyncapi");
const { COMPILER_TYPES, OPENAPI_SERVERS_ANNOTATION, ORD_MEDIA_TYPE } = require("./constants");
const Logger = require("./logger");
const { interopCSN } = require("./interopCsn.js");
const cdsc = require("@sap/cds-compiler/lib/main");
const { isMCPPluginReady, buildMcpServerDefinition } = require("./mcpAdapter");

/**
 * Read @OpenAPI.servers annotation from service definition
 * @param {object} csn - The CSN model
 * @param {string} serviceName - The service name
 * @returns {string|undefined} - JSON string of servers array or undefined
 */
const _getServersFromAnnotation = (csn, serviceName) => {
    const servers = csn?.definitions?.[serviceName]?.[OPENAPI_SERVERS_ANNOTATION];
    const isValidServers = Array.isArray(servers) && servers.length > 0;
    return isValidServers ? JSON.stringify(servers) : undefined;
};

/**
 * Check if @cap-js/graphql is available
 * @returns {boolean}
 */
let _graphqlAvailable;
const isGraphQLPluginReady = () => {
    if (_graphqlAvailable === undefined) {
        try {
            require.resolve("@cap-js/graphql/lib/schema");
            _graphqlAvailable = true;
        } catch {
            _graphqlAvailable = false;
        }
    }
    return _graphqlAvailable;
};

/**
 * Compile CDS model to GraphQL SDL schema
 * @param {object} csn - The CSN model
 * @param {string} serviceName - The service name
 * @returns {string} - GraphQL SDL schema as string
 */
const _compileToGraphQL = (csn, serviceName) => {
    if (!isGraphQLPluginReady()) {
        throw new Error(
            "GraphQL SDL generation requires @cap-js/graphql. Install it with: npm add @cap-js/graphql",
        );
    }

    const { generateSchema4 } = require("@cap-js/graphql/lib/schema");
    const { printSchema, lexicographicSortSchema } = require("graphql");

    const model = cds.linked(csn);
    const services = { [serviceName]: new cds.ApplicationService(serviceName, model) };

    const schema = generateSchema4(services);
    return printSchema(lexicographicSortSchema(schema));
};

/**
 * Get content type for a given compiler type
 * @param {string} compilerType - The compiler type
 * @returns {string} - The content type
 */
const _getContentType = (compilerType) => {
    const contentTypeMap = {
        [COMPILER_TYPES.edmx]: ORD_MEDIA_TYPE.XML,
        [COMPILER_TYPES.graphql]: ORD_MEDIA_TYPE.TEXT_PLAIN,
    };
    return contentTypeMap[compilerType] || ORD_MEDIA_TYPE.JSON;
};

const getMetadata = async (url, model = null) => {
    const parts = url
        ?.split("/")
        .pop()
        .replace(/\.json$/, "")
        .split(".");
    const compilerType = parts.pop();
    const serviceName = parts.join(".");
    const csn = model || cds.services[serviceName]?.model;
    const compileOptions = cds.env["ord"]?.compileOptions || {};

    let responseFile;
    const options = { service: serviceName, as: "str", messages: [] };
    switch (compilerType) {
        case COMPILER_TYPES.oas3:
            try {
                // Check for service-level @OpenAPI.servers annotation
                const serversFromAnnotation = _getServersFromAnnotation(csn, serviceName);
                const openapiOptions = { ...options, ...(compileOptions?.openapi || {}) };

                // Service-level annotation takes precedence over global config
                if (serversFromAnnotation) {
                    openapiOptions["openapi:servers"] = serversFromAnnotation;
                }

                responseFile = openapi(csn, openapiOptions);
            } catch (error) {
                Logger.error("OpenApi error:", error.message);
                throw error;
            }
            break;
        case COMPILER_TYPES.asyncapi2:
            try {
                responseFile = asyncapi(csn, { ...options, ...(compileOptions?.asyncapi || {}) });
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
                responseFile = await cds.compile(csn).to["edmx"]({ ...options, ...(compileOptions?.edmx || {}) });
            } catch (error) {
                Logger.error("Edmx error:", error.message);
                throw error;
            }
            break;
        case COMPILER_TYPES.mcp:
            if (!isMCPPluginReady()) {
                throw new Error("MCP plugin is not available or not ready for use");
            }
            try {
                // Get all available CDS services
                const allServices = Object.values(cds.services);
                // Generate metadata from runtime services using adapter
                const mcpResult = await buildMcpServerDefinition(allServices);
                // Extract only the MCP content, not the ORD metadata
                responseFile = mcpResult.mcp;
            } catch (error) {
                Logger.error("MCP server definition error:", error.message);
                throw error;
            }
            break;
        case COMPILER_TYPES.graphql:
            try {
                responseFile = _compileToGraphQL(csn, serviceName);
            } catch (error) {
                Logger.error("GraphQL SDL error:", error.message);
                throw error;
            }
            break;
    }
    return {
        contentType: _getContentType(compilerType),
        response: responseFile,
    };
};

module.exports = getMetadata;
