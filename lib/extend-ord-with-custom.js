const cds = require("@sap/cds");
const fs = require("fs");
const Logger = require("./logger");
const path = require("path");
const _ = require("lodash");

const SCALAR_TYPES = Object.freeze(["number", "string", "boolean"]);

const MERGE_STRATEGIES = Object.freeze({
    // Directly replace scalar values and scalar value arrays
    $schema: (current, custom) => custom,
    description: (current, custom) => custom,
    perspective: (current, custom) => custom,
    openResourceDiscovery: (current, custom) => custom,
    policyLevel: (current, custom) => custom,
    customPolicyLevel: (current, custom) => custom,
    policyLevels: (current, custom) => prune(custom),

    // Perform simple merge for objects
    describedSystemType: (current, custom) => prune(_.assign(current, custom)),
    describedSystemVersion: (current, custom) => prune(_.assign(current, custom)),
    describedSystemInstance: (current, custom) => prune(_.assign(current, custom)),

    // Perform smart merge for arrays of objects
    agents: (current, custom) => merge(custom, current, ["ordId"]),
    vendors: (current, custom) => merge(custom, current, ["ordId"]),
    overlays: (current, custom) => merge(custom, current, ["ordId"]),
    products: (current, custom) => merge(custom, current, ["ordId"]),
    packages: (current, custom) => merge(custom, current, ["ordId"]),
    groups: (current, custom) => merge(custom, current, ["groupId"]),
    entityTypes: (current, custom) => merge(custom, current, ["ordId"]),
    apiResources: (current, custom) => merge(custom, current, ["ordId"]),
    capabilities: (current, custom) => merge(custom, current, ["ordId"]),
    dataProducts: (current, custom) => merge(custom, current, ["ordId"]),
    eventResources: (current, custom) => merge(custom, current, ["ordId"]),
    groupTypes: (current, custom) => merge(custom, current, ["groupTypeId"]),
    consumptionBundles: (current, custom) => merge(custom, current, ["ordId"]),
    integrationDependencies: (current, custom) => merge(custom, current, ["ordId"]),
    tombstones: (current, custom) => merge(custom, current, ["ordId", "groupId", "groupTypeId"]),
});

function prune(entity) {
    if (Array.isArray(entity)) {
        return entity
            .filter((value) => ![null, undefined].includes(value))
            .map((value) => (SCALAR_TYPES.includes(typeof value) ? value : prune(value)));
    }

    return Object.fromEntries(
        Object.entries(entity)
            .filter(([, value]) => ![null, undefined].includes(value))
            .map(([key, value]) => [key, SCALAR_TYPES.includes(typeof value) ? value : prune(value)]),
    );
}

function merge(source, target, keys) {
    const iteratee = (entity) => keys.map((key) => entity[key] || "").join(".");
    const sources = _.keyBy(source || [], iteratee);
    const targets = _.keyBy(target || [], iteratee);

    return Array.from(new Set([...Object.keys(sources), ...Object.keys(targets)])) //
        .map((key) => _.assign(structuredClone(targets[key]), structuredClone(sources[key])))
        .map(prune);
}

module.exports = {
    MERGE_STRATEGIES,
    getCustomORDContent: (configuration) => {
        if (!configuration.env?.customOrdContentFile) return {};

        const file = path.join(cds.root, configuration.env?.customOrdContentFile);
        if (!fs.existsSync(file)) {
            Logger.error("Custom ORD content file not found at", file);
            return {};
        }

        return JSON.parse(fs.readFileSync(file, "utf8"));
    },
    compareAndHandleCustomORDContentWithExistingContent: (ordContent, customORDContent) => {
        return Object.fromEntries([
            // Process elements found only in 'ordContent'
            ...Object.entries(ordContent)
                .filter(([key]) => !(key in customORDContent))
                .map(([key, value]) => [key, structuredClone(value)]),

            // Process elements found only in 'customORDContent'
            ...Object.entries(customORDContent)
                .filter(([key]) => !(key in ordContent))
                .map(([key, value]) => [key, structuredClone(value)]),

            // Process elements found in both 'ordContent' and 'customORDContent'
            ...Object.entries(customORDContent)
                .filter(([key]) => key in ordContent)
                .filter(([, value]) => ![null, undefined].includes(value))
                .map(([key, value]) => [key, MERGE_STRATEGIES[key](structuredClone(ordContent[key]), value)]),
        ]);
    },
};
