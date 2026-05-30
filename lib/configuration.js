const path = require("path");
const cds = require("@sap/cds");
const { readFileSync } = require("fs");

const Logger = require("./logger");
const defaults = require("./defaults");
const { getRFC3339Date } = require("./common/utils");
const { createAuthConfig } = require("./auth/authentication");
const { CDS_ELEMENT_KIND, ORD_EXTENSIONS_PREFIX } = require("./constants");
const { ensureAccessStrategies, getAccessStrategiesFromAuthConfig } = require("./access-strategies");

module.exports = class Configuration {
    constructor(csn) {
        const env = cds.env["ord"];
        const authConfig = createAuthConfig();
        const packageName = this._loadNameFromPackageJson();
        const eventApplicationNamespace = cds.env?.export?.asyncapi?.applicationNamespace;
        const ordNamespace = cds.env["ord"]?.namespace || `customer.${packageName.replace(/[^a-zA-Z0-9]/g, "")}`;

        if (eventApplicationNamespace && ordNamespace !== eventApplicationNamespace) {
            Logger.warn("ORD and AsyncAPI namespaces should be the same.");
        }

        if (authConfig.error) {
            throw new Error(`Authentication configuration error: ${authConfig.error}`);
        }

        this._env = env;
        this._authConfig = authConfig;
        this._packageName = packageName;
        this._ordNamespace = ordNamespace;
        this._lastUpdate = getRFC3339Date();
        this._csn = this._propagateORDVisibility(csn);
        this._internalNamespace = env?.internalNamespace;
        this._existingProductORDId = env?.existingProductORDId;
        this._appName = packageName.replace(/^@/, "").replace(/[@/]/g, "-");
        this._policyLevels = env?.policyLevels || (env?.policyLevel && [env?.policyLevel]) || defaults.policyLevels;
        this._accessStrategies = ensureAccessStrategies(getAccessStrategiesFromAuthConfig(authConfig.accessStrategies ?? []));
    }

    get env() {
        return this._env;
    }

    get csn() {
        return this._csn;
    }

    get appName() {
        return this._appName;
    }

    get authConfig() {
        return this._authConfig;
    }

    get lastUpdate() {
        return this._lastUpdate;
    }

    get packageName() {
        return this._packageName;
    }

    get ordNamespace() {
        return this._ordNamespace;
    }

    get policyLevels() {
        return this._policyLevels;
    }

    get accessStrategies() {
        return this._accessStrategies;
    }

    get internalNamespace() {
        return this._internalNamespace;
    }

    get hasSAPPolicyLevel() {
        return this.policyLevels.some((policyLevel) => policyLevel.split(":")[0].toLowerCase() === "sap");
    }

    get existingProductORDId() {
        return this._existingProductORDId;
    }

    _loadNameFromPackageJson() {
        const packageJsonPath = path.join(cds.root, "package.json");

        if (!cds.utils.exists(packageJsonPath)) {
            throw new Error("package.json not found in the project root directory");
        }

        return JSON.parse(readFileSync(packageJsonPath, "utf-8")).name;
    }

    _propagateORDVisibility(csn) {
        Object.values(csn.definitions)
            .filter((definition) => definition.kind === CDS_ELEMENT_KIND.service)
            .filter((service) => service[ORD_EXTENSIONS_PREFIX + "visibility"])
            .forEach((service) => {
                Object.values(csn.definitions)
                    .filter((definition) => definition.name.startsWith(`${service.name}.`))
                    .filter((definition) => !definition[ORD_EXTENSIONS_PREFIX + "visibility"])
                    .forEach((definition) => {
                        definition[ORD_EXTENSIONS_PREFIX + "visibility"] =
                            service[ORD_EXTENSIONS_PREFIX + "visibility"];
                    });
            });

        return csn;
    }
};
