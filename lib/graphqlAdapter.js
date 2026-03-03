const cds = require("@sap/cds/lib");
const Logger = require("./logger");

/**
 * GraphQL Plugin Adapter
 * Provides an abstraction layer for interacting with @cap-js/graphql
 * This allows for easy mocking and testing without requiring the actual plugin
 */

/**
 * Check if @cap-js/graphql is available at runtime
 * @param {Function} resolveFunction - Optional custom resolve function for testing
 * @returns {boolean} True if plugin is available
 */
let _graphqlAvailable;
function isGraphQLPluginReady(resolveFunction = require.resolve) {
    if (_graphqlAvailable === undefined) {
        try {
            resolveFunction("@cap-js/graphql/lib/schema");
            _graphqlAvailable = true;
        } catch {
            _graphqlAvailable = false;
        }
    }
    return _graphqlAvailable;
}

/**
 * Compile CDS model to GraphQL SDL schema
 * @param {object} csn - The CSN model
 * @param {string} serviceName - The service name
 * @returns {string} GraphQL SDL schema as string
 */
function compileToGraphQL(csn, serviceName) {
    if (!isGraphQLPluginReady()) {
        throw new Error(
            "GraphQL SDL generation requires @cap-js/graphql. Install it with: npm add @cap-js/graphql",
        );
    }

    try {
        const { generateSchema4 } = require("@cap-js/graphql/lib/schema");
        const { printSchema, lexicographicSortSchema } = require("graphql");

        const model = cds.linked(csn);
        const services = { [serviceName]: new cds.ApplicationService(serviceName, model) };

        const schema = generateSchema4(services);
        return printSchema(lexicographicSortSchema(schema));
    } catch (error) {
        Logger.error("Failed to compile GraphQL SDL:", error.message);
        throw error;
    }
}

module.exports = {
    isGraphQLPluginReady,
    compileToGraphQL,
};
