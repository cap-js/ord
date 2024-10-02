const path = require("path");
const cds = require("@sap/cds");

function getCustomORDContent(appConfig) {
    if (appConfig.env.customOrdContentFile) {
        const customORDContent = require(path.join(cds.root, appConfig.env.customOrdContentFile));
        return customORDContent;
    }
    return {};
}

function handleExistingContentIfIsObject(newOrdContent, customORDContent, key) {
    const existingContent = newOrdContent[key];
    for (const subCustomObj of customORDContent[key]) {
        const customContentSubObjOrdId = subCustomObj.ordId;
        for (const existingContentSubObj of structuredClone(existingContent)) {
            const existingContentSubObjOrdId = existingContentSubObj.ordId;
            if (customContentSubObjOrdId === existingContentSubObjOrdId) {
                throw new Error(`Detect conflict ordId in custom ORD: ${key}, ordId: ${customContentSubObjOrdId}, please resolve it.`);
            } else {
                existingContent.push(subCustomObj);
                console.log(`Add custom ORD content: ${key}, OrdId: ${customContentSubObjOrdId}, newOrdContent: ${JSON.stringify(newOrdContent)}`);

            }
        }
    }
}

function compareAndHandleCustomORDContentWithExistingContent(customORDContent, ordContent) {
    const newOrdContent = structuredClone(ordContent);
    for (const key in customORDContent) {
        if (key in newOrdContent) {
            if (typeof newOrdContent[key] === 'object') {
                handleExistingContentIfIsObject(newOrdContent, customORDContent, key);
            } else {
                throw new Error(`Detect conflict value with exiting in custom ORD content: ${key}, please resolve it. if
                    you want to keep it, please define it in .cdsrc.json`);
            }
        } else {
            newOrdContent[key] = customORDContent[key];
        }
    }
    return newOrdContent;
}

// TODO: extend existing items
// TODO: handle conflicts
// TODO: deep clone
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
