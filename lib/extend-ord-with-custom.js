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
    policyLevels: (current, custom) => prune(custom),

    // Perform simple merge for objects
    describedSystemType: (current, custom) => prune(_.assign(current, custom)),
    describedSystemVersion: (current, custom) => prune(_.assign(current, custom)),
    describedSystemInstance: (current, custom) => prune(_.assign(current, custom)),

    // Perform smart merge for arrays of objects
    agents: (current, custom) => merge(current, custom, ["ordId"]),
    vendors: (current, custom) => merge(current, custom, ["ordId"]),
    overlays: (current, custom) => merge(current, custom, ["ordId"]),
    products: (current, custom) => merge(current, custom, ["ordId"]),
    packages: (current, custom) => merge(current, custom, ["ordId"]),
    groups: (current, custom) => merge(current, custom, ["groupId"]),
    entityTypes: (current, custom) => merge(current, custom, ["ordId"]),
    apiResources: (current, custom) => merge(current, custom, ["ordId"]),
    capabilities: (current, custom) => merge(current, custom, ["ordId"]),
    dataProducts: (current, custom) => merge(current, custom, ["ordId"]),
    eventResources: (current, custom) => merge(current, custom, ["ordId"]),
    groupTypes: (current, custom) => merge(current, custom, ["groupTypeId"]),
    consumptionBundles: (current, custom) => merge(current, custom, ["ordId"]),
    integrationDependencies: (current, custom) => merge(current, custom, ["ordId"]),
    tombstones: (current, custom) => merge(current, custom, ["ordId", "groupId", "groupTypeId"]),
});

function prune(entity) {
    const pruned = Object.entries(entity)
        .filter(([, value]) => ![null, undefined].includes(value))
        .map(([key, value]) => [key, SCALAR_TYPES.includes(typeof value) ? value : prune(value)]);

    return !Array.isArray(entity) ? Object.fromEntries(pruned) : pruned.map(([, value]) => value);
}

function merge(destinationObj, sourceObj, keys) {
    const iteratee = (entity) => keys.map((key) => entity[key] || "").join(".");
    const srcObj = _.keyBy(sourceObj || [], iteratee);
    const destObj = _.keyBy(destinationObj || [], iteratee);

    return Array.from(new Set([...Object.keys(srcObj), ...Object.keys(destObj)])) //
        .map((key) => _.assignWith(structuredClone(destObj[key]), structuredClone(srcObj[key])))
        .map(prune);
}

module.exports = {
    getCustomORDContent: (configuration) => {
        if (!configuration.env?.customOrdContentFile) return {};

        const file = path.join(cds.root, configuration.env?.customOrdContentFile);
        if (!fs.existsSync(file)) {
            Logger.error("Custom ORD content file not found at", file);
            return {};
        }

        return require(file);
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
                .filter((key) => !(key in ordContent))
                .map(([key, value]) => [key, structuredClone(value)]),

            // Process elements found in both 'ordContent' and 'customORDContent'
            ...Object.entries(customORDContent)
                .filter(([key]) => key in ordContent)
                .filter(([, value]) => ![null, undefined].includes(value))
                .map(([key, value]) => [key, MERGE_STRATEGIES[key](structuredClone(ordContent[key]), value)]),
        ]);
    },
};
