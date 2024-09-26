const path = require("path");
const cds = require("@sap/cds");

function getCustomORDContent(global) {
    if(global.env.customOrdContentFile){
        const customORDContent = require(path.join(cds.root, global.env.customOrdContentFile));
        return customORDContent;
    }
    return {};
}

function compareAndHandleCustomORDContentWithExistingContent(customORDContent, ordContent) {
    let newOrdContent = structuredClone(ordContent);
    for (const key in customORDContent) {
       if (key in newOrdContent) {
           if (Array.isArray(customORDContent[key])) {
               newOrdContent[key] = [...newOrdContent[key], ...customORDContent[key]];
           } else if (typeof customORDContent[key] === 'object') {
               newOrdContent[key] = {...newOrdContent[key], ...customORDContent[key]};
           }
       }
    }
    return newOrdContent;
}

// TODO: extend existing items
// TODO: handle conflicts
// TODO: deep clone
// TODO: handle annotations: partOfPackage
function addCustomORDContentIfExists(global, oReturn) {
    const customORDContent = getCustomORDContent(global);
    if(customORDContent){
        oReturn = compareAndHandleCustomORDContentWithExistingContent(customORDContent, oReturn);
    }
    return oReturn;
}

module.exports = {
    addCustomORDContentIfExists,
};
