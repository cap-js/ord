const cds = require("@sap/cds");

const _debugLevel = cds.env?.DEBUG || process.env.DEBUG;

function _getLogLevel(debugLevel, logLevels) {
    return debugLevel ? logLevels.DEBUG : logLevels.WARN;
}

const level = _getLogLevel(_debugLevel, cds.log?.levels);

const Logger = cds.log("ord-plugin", {
    level,
});

module.exports = {
    Logger,
};
