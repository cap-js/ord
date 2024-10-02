const path = require("path");
const cds = require("@sap/cds");

const ORD_ENV_KEY = 'ord';

function recursivelyExtend() {
//
}

function ifOrdIdExsits(existingContentItem, customItemOrdId) {
    for (const existingItem of existingContentItem) {
        if (existingItem.ordId === customItemOrdId) {
            return true;
        }
    }
    return false
}

function updateExistingContent(clonedExistingContent, customORDContent, customItemOrdId) {
    for (let existingItem of clonedExistingContent) {
        if (existingItem.ordId === customItemOrdId) {
            existingItem = customORDContent;
        }
    }
}

function handleArrayConflicts(clonedOrdContent, customORDContent, key) {
    const clonedExistingContent = structuredClone(clonedOrdContent);
    for (const item of customORDContent[key]) {
        const customItemOrdId = item.ordId;
        if (ifOrdIdExsits(clonedOrdContent[key], customItemOrdId)) {
            updateExistingContent(clonedExistingContent[key], item, customItemOrdId);
        } else {
            clonedExistingContent[key].push(item);
        }
    }
    clonedOrdContent[key] = clonedExistingContent[key];
}

function hasStringConflictsWithCdsrcJson(key) {
    if (key in cds.env[ORD_ENV_KEY]) {
        console.error(`Detect ord custom content has conflict with .cdsrc.json: ${key},
            please resolve it, use .cdsrc.json value.`);
        return true;
    }
    return false;
}

function handleStringConflicts(key) {
    if (!hasStringConflictsWithCdsrcJson(key)) {
        console.error(`Detect ord custom content has conflict with default value: ${key},
            please define it in .cdsrc.json.`);
    }
}

function compareAndHandleCustomORDContentWithExistingContent(customORDContent, ordContent) {
    const clonedOrdContent = structuredClone(ordContent);
    for (const key in customORDContent) {
        if (key in clonedOrdContent) {
            if (typeof clonedOrdContent[key] === 'string') {
                handleStringConflicts(key);
            } else {
                handleArrayConflicts(clonedOrdContent, customORDContent, key);
            }
        } else {
            if (typeof customORDContent[key] === 'string') {
                if (hasStringConflictsWithCdsrcJson(key)) {
                    continue;
                }
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

// TODO: extend existing items and handle conflict:
// 1. package w/wo ord id: just merged
// 2. package with ord id, title conflict, extend with custom content
// TODO: handle annotations: partOfPackage
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
