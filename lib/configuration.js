const path = require("path");
const cds = require("@sap/cds");
const { readFileSync } = require("fs");

const Logger = require("./logger");
const defaults = require("./defaults");
const { getRFC3339Date } = require("./common/utils");
const { createAuthConfig } = require("./auth/authentication");
const { resolveAccessStrategies } = require("./common/utils");
const { CDS_ELEMENT_KIND } = require("./constants");

module.exports = class Configuration {
    constructor(csn) {
        const env = cds.env["ord"];
        const authConfig = createAuthConfig();
        const packageName = this._loadNameFromPackageJson();
        const eventApplicationNamespace = cds.env?.export?.asyncapi?.applicationNamespace;
        const ordNamespace = env?.namespace || `customer.${packageName.replace(/[^a-zA-Z0-9]/g, "")}`;

        if (eventApplicationNamespace && ordNamespace !== eventApplicationNamespace) {
            Logger.warn("ORD and AsyncAPI namespaces should be the same.");
        }

        if (authConfig.error) {
            throw new Error(`Authentication configuration error: ${authConfig.error}`);
        }

        this._env = env;
        this._packageName = packageName;
        this._ordNamespace = ordNamespace;
        this._lastUpdate = getRFC3339Date();
        this._csn = this._propagateORDVisibility(cds.linked(csn));
        this._accessStrategies = resolveAccessStrategies(authConfig);
        this._appName = packageName.replace(/^@/, "").replace(/[@/]/g, "-");
        this._policyLevels = env?.policyLevels || (env?.policyLevel && [env?.policyLevel]) || defaults.policyLevels;
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
        return this._env?.internalNamespace;
    }

    get hasSAPPolicyLevel() {
        return this.policyLevels.some((policyLevel) => policyLevel.split(":")[0].toLowerCase() === "sap");
    }

    get existingProductORDId() {
        return this._env?.existingProductORDId;
    }

    _loadNameFromPackageJson() {
        const packageJsonPath = path.join(cds.root, "package.json");

        if (!cds.utils.exists(packageJsonPath)) {
            throw new Error("package.json not found in the project root directory");
        }

        return JSON.parse(readFileSync(packageJsonPath, "utf-8")).name;
    }

    _propagateORDVisibility(csn) {
        const annotation = "@ORD.Extensions.visibility";

        Object.values(csn.definitions)
            .filter((service) => Boolean(service[annotation]))
            .filter((definition) => definition.kind === CDS_ELEMENT_KIND.service)
            .forEach((service) => {
                Object.values(csn.definitions)
                    .filter((definition) => definition.name.startsWith(`${service.name}.`))
                    .forEach((definition) => (definition[annotation] ??= service[annotation]));
            });

        return csn;
    }
};
