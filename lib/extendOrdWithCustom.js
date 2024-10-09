const path = require("path");
const cds = require("@sap/cds");
const _ = require('lodash');

const CONTENT_MERGE_KEY = 'ordId'
const LOG = cds.log('ord-plugin');

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
        if (typeof customORDContent[key] === 'string') {
            LOG.warn('Found ord top level ord string property in customOrdFile:', key, ', please define it in .cdsrc.json.');
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
