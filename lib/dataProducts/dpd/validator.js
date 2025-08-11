const { Logger } = require("../../logger");

// TODO: Add validation against FOS V2 schema
function validateDpd(dpd) {
    const requiredFeilds = ['name', 'version', 'title', 'type'];
    for (const field of requiredFeilds) {
        if (!dpd[field]) {
            Logger.error(`Missing required field: ${field}`);
            return false;
        }
    }
    
    return true;
}

module.exports = {
    validateDpd
};