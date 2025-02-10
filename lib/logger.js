const cds = require("@sap/cds");

const _debugLevel = cds.env?.DEBUG || process.env.DEBUG;

function _getLogLevel(debugLevel, logLevels) {
    if (debugLevel) {
        logLevels.DEBUG
    }
    return logLevels.WARN;
}

const logLevel = _getLogLevel(_debugLevel, cds.log?.levels);

const Logger = cds.log("ord-plugin", {
    level: logLevel,
});

module.exports = {
    Logger,
};
