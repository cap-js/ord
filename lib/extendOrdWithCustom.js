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

function patchGeneratedOrdResources(destinationObj, sourceObj) {
    const destObj = _.keyBy(destinationObj, CONTENT_MERGE_KEY);
    const srcObj = _.keyBy(sourceObj, CONTENT_MERGE_KEY);
    for (const ordId in srcObj) {
        if (ordId in destObj) {
            destObj[ordId] = _.merge(structuredClone(destObj[ordId]), structuredClone(srcObj[ordId]));
            console.log(JSON.stringify(destObj[ordId].entityTypeMappings));
        } else {
            destObj[ordId] = srcObj[ordId];
        }
    }
    return cleanNullProperties(Object.values(destObj));
}

function compareAndHandleCustomORDContentWithExistingContent(ordContent, customORDContent) {
    const clonedOrdContent = structuredClone(ordContent);
    for (const key in customORDContent) {
        if (key in ordContent) {
            if (typeof clonedOrdContent[key] === 'string') {
                handleStringConflicts(key);
            } else {
                clonedOrdContent[key] = patchGeneratedOrdResources(clonedOrdContent[key], customORDContent[key]);
            }
        } else {
            if (typeof customORDContent[key] === 'string' && hasStringConflictsWithCdsrcJson(key)) {
                continue;
            }
            clonedOrdContent[key] = customORDContent[key];
        }
    }
    return clonedOrdContent;
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
        ordContent = compareAndHandleCustomORDContentWithExistingContent(ordContent, customORDContent);
    }
    return ordContent;
}

module.exports = {
    extendCustomORDContentIfExists,
};
