const { CONTENT_MERGE_KEY } = require("./constants");
const cds = require("@sap/cds");
const fs = require("fs");
const { Logger } = require("./logger");
const path = require("path");
const _ = require("lodash");

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
            destObj[ordId] = _.assignWith(structuredClone(destObj[ordId]), structuredClone(srcObj[ordId]));
        } else {
            destObj[ordId] = srcObj[ordId];
        }
    }
    return cleanNullProperties(Object.values(destObj));
}

function compareAndHandleCustomORDContentWithExistingContent(ordContent, customORDContent) {
    const clonedOrdContent = structuredClone(ordContent);
    for (const key in customORDContent) {
        const propertyType = typeof customORDContent[key];
        if (propertyType !== 'object' && propertyType !== 'array') {
            Logger.warn(`Found ord top level primitive ord property in customOrdFile: ${key}. Please define it in .cdsrc.json.`);

            continue;
        }
        if (key in ordContent) {
            clonedOrdContent[key] = patchGeneratedOrdResources(clonedOrdContent[key], customORDContent[key]);
        } else {
            clonedOrdContent[key] = customORDContent[key];
        }
    }
    return clonedOrdContent;
}

function getCustomORDContent(appConfig) {
    if (!appConfig.env?.customOrdContentFile) return;
    const pathToCustomORDContent = path.join(cds.root, appConfig.env?.customOrdContentFile);
    if (fs.existsSync(pathToCustomORDContent))  {
        Logger.warn(`Custom ORD content file not found at ${pathToCustomORDContent}`);
        return require(pathToCustomORDContent);
    }
}

function extendCustomORDContentIfExists(appConfig, ordContent) {
    const customORDContent = getCustomORDContent(appConfig);
    return customORDContent ? compareAndHandleCustomORDContentWithExistingContent(ordContent, customORDContent) : ordContent;
}

module.exports = {
    extendCustomORDContentIfExists,
};
