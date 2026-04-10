const cds = require("@sap/cds");
const Logger = require("../logger");

const PROTOCOL_PROVIDERS = Object.freeze({
    ["@cap-js/mcp"]: "mcp",
    ["@cap-js/graphql"]: "graphql",
});

module.exports = () => {
    // Plugins like @cap-js/mcp and @cap-js/graphql register protocols and compile targets
    // at runtime via cds-plugin.js, but cds build rebuilds cds.env afterward, losing both
    // registrations. Re-apply so that compilation works accordingly during build and runtime.

    Object.keys(cds.env.plugins || {})
        .filter((plugin) => plugin !== "@cap-js/ord")
        .forEach((plugin) => {
            try {
                const protocol = PROTOCOL_PROVIDERS[plugin];

                require(`${plugin}/lib/api`)?.registerCompileTargets?.();
                cds.env.protocols = {
                    ...cds.env.protocols,
                    ...(!protocol || cds.env.protocols?.[protocol]
                        ? {}
                        : { [protocol]: { path: `/${protocol}`, impl: plugin } }),
                };
            } catch (error) {
                Logger.warn(`Failed to register compile targets for ${plugin}: ${error}`);
            }
        });
};
