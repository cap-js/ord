/**
 * Checks if at least one policy level in the array is SAP.
 *
 * @param {string[]} policyLevels - Array of policy levels.
 */
function hasSAPPolicyLevel(policyLevels) {
    return policyLevels && policyLevels.some((policyLevel) => policyLevel.split(":")[0].toLowerCase() === "sap");
}

module.exports = {
    hasSAPPolicyLevel,
};
