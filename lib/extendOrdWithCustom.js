const path = require("path");
const cds = require("@sap/cds");
const _ = require('lodash');

const ORD_ENV_KEY = 'ord';
const CONTENT_MERGE_KEY = 'ordId'

function hasStringConflictsWithCdsrcJson(key) {
    if (key in cds.env[ORD_ENV_KEY]) {
        console.error(`Detect ord custom content has conflict with .cdsrc.json: ${key},
            please resolve it, use .cdsrc.json value.`);
        return true;
    }
    return false;
}

function handleStringConflicts(key) {
    if (hasStringConflictsWithCdsrcJson(key)) {
        return;
    }
    console.error(`Detect ord custom content has conflict with default value: ${key},
        please define it in .cdsrc.json.`);
}

function deepMerge(destinationObj, sourceObj) {
    return _.values(_.merge(
        _.keyBy(destinationObj, CONTENT_MERGE_KEY),
        _.keyBy(sourceObj, CONTENT_MERGE_KEY)
    ));
}

function cleanNullProperties(obj) {
    for (const key in obj) {
        if (obj[key] === null) {
            delete obj[key];
        } else if (typeof obj[key] === 'object') {
            cleanNullProperties(obj[key]);
        }
    }
    return obj;
}

function compareAndHandleCustomORDContentWithExistingContent(customORDContent, ordContent) {
    const clonedOrdContent = structuredClone(ordContent);
    for (const key in customORDContent) {
        if (key in ordContent) {
            if (typeof clonedOrdContent[key] === 'string') {
                handleStringConflicts(key);
            } else {
                clonedOrdContent[key] = deepMerge(clonedOrdContent[key], customORDContent[key]);
            }
        } else {
            if (typeof customORDContent[key] === 'string' && hasStringConflictsWithCdsrcJson(key)) {
                continue;
            }
            clonedOrdContent[key] = customORDContent[key];
        }
    }
    return cleanNullProperties(clonedOrdContent);
}

function getCustomORDContent(appConfig) {
    if (appConfig.env.customOrdContentFile) {
        const customORDContent = require(path.join(cds.root, appConfig.env.customOrdContentFile));
        return customORDContent;
    }
    return {};
}

function extendCustomORDContentIfExists(appConfig, ordContent) {
    const customORDContent = getCustomORDContent(appConfig);
    if (customORDContent) {
        ordContent = compareAndHandleCustomORDContentWithExistingContent(customORDContent, ordContent);
    }
    return ordContent;
}

module.exports = {
    extendCustomORDContentIfExists,
};
