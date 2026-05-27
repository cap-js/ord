const path = require("path");
const cds = require("@sap/cds");
const _ = require("lodash");
const { readFileSync } = require("fs");

const Logger = require("./logger");
const defaults = require("./defaults");
const { createAuthConfig } = require("./auth/authentication");
const { createEntityTypeMappingsItemTemplate } = require("./templates");
const { getRFC3339Date, isExternalDataProduct } = require("./common/utils");
const { CONTENT_MERGE_KEY, CDS_ELEMENT_KIND, EXTERNAL_DP_ORD_ID_ANNOTATION } = require("./constants");

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
        this._internalNamespace = env?.internalNamespace;
        this._serviceNames = this._resolveServiceNames(csn);
        this._existingProductORDId = env?.existingProductORDId;
        this._apiResourceNames = this._resolveApiResourceNames(csn);
        this._entityTypeTargets = this._resolveEntityTypeTargets(csn);
        this._eventServiceNames = this._resolveEventServiceNames(csn);
        this._appName = packageName.replace(/^@/, "").replace(/[@/]/g, "-");
        this._externalServiceNames = this._resolveExternalServiceNames(csn);
        this._policyLevels = env?.policyLevels || (env?.policyLevel && [env?.policyLevel]) || defaults.policyLevels;
    }

    _resolveExternalServiceNames(csn) {
        return Object.keys(csn.definitions)
            .filter((name) => isExternalDataProduct(csn.definitions[name]))
            .filter((name) => "apiResource" === csn.definitions[name][EXTERNAL_DP_ORD_ID_ANNOTATION].split(":")[1]);
    }

    get authConfig() {
        return this._authConfig;
    }

    get env() {
        return this._env;
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

    get serviceNames() {
        return this._serviceNames;
    }

    get ordNamespace() {
        return this._ordNamespace;
    }

    get internalNamespace() {
        return this._internalNamespace;
    }

    get policyLevels() {
        return this._policyLevels;
    }

    get apiResourceNames() {
        return this._apiResourceNames;
    }

    get externalServiceNames() {
        return this._externalServiceNames;
    }

    get entityTypeTargets() {
        return this._entityTypeTargets;
    }

    get eventServiceNames() {
        return this._eventServiceNames;
    }

    get hasSAPPolicyLevel() {
        return this.policyLevels.some((policyLevel) => policyLevel.split(":")[0].toLowerCase() === "sap");
    }

    get existingProductORDId() {
        return this._existingProductORDId;
    }

    _resolveServiceNames(csn) {
        return Object.keys(csn.definitions) //
            .filter((name) => this._isValidService(name, csn.definitions[name]));
    }

    _loadNameFromPackageJson() {
        const packageJsonPath = path.join(cds.root, "package.json");

        if (!cds.utils.exists(packageJsonPath)) {
            throw new Error("package.json not found in the project root directory");
        }

        return JSON.parse(readFileSync(packageJsonPath, "utf-8")).name;
    }

    _isBlockedServiceName(name) {
        return ["cds.xt.MTXServices", "MtxOrdProviderService", "OpenResourceDiscoveryService"] //
            .some((blocked) => name.includes(blocked));
    }

    _resolveApiResourceNames(csn) {
        return Object.keys(csn.definitions)
            .filter((name) => this._isValidService(name, csn.definitions[name]))
            .filter((name) => !this._serviceOnlyContainsEvents(csn.definitions[name]));
    }

    _resolveEntityTypeTargets(csn) {
        return _.uniqBy(
            Object.keys(csn.definitions)
                .filter((name) => !name.includes(".texts"))
                .filter((name) => !this._isBlockedServiceName(name))
                .filter((name) => csn.definitions[name].kind === CDS_ELEMENT_KIND.entity)
                .filter((name) => csn.definitions[name]["_service"]?.["@protocol"] !== "none")
                .flatMap((name) => createEntityTypeMappingsItemTemplate(csn.definitions[name]) || []),
            CONTENT_MERGE_KEY,
        );
    }

    _resolveEventServiceNames(csn) {
        const serviceNames = this._resolveServiceNames(csn);

        return [
            ...new Set(
                Object.keys(csn.definitions)
                    .filter((name) => !this._isBlockedServiceName(name))
                    .filter((name) => csn.definitions[name].kind === CDS_ELEMENT_KIND.event)
                    .filter((name) => csn.definitions[name]["_service"]?.["@protocol"] !== "none")
                    .filter((name) => serviceNames.some((serviceName) => name.startsWith(`${serviceName}.`)))
                    .map((name) => serviceNames.find((serviceName) => name.startsWith(`${serviceName}.`))),
            ),
        ];
    }

    _isValidService(key, definition) {
        const isExternalService = Object.keys(cds).includes("requires") && Object.keys(cds.requires).includes(key);

        return (
            definition.kind === CDS_ELEMENT_KIND.service &&
            !definition["@cds.external"] &&
            definition["@protocol"] !== "none" &&
            !isExternalService &&
            !this._isBlockedServiceName(key)
        );
    }

    _serviceOnlyContainsEvents(definition) {
        return (
            Object.keys(definition.events || {}).length > 0 &&
            ["actions", "entities", "functions"].every((key) => Object.keys(definition[key] || {}).length === 0)
        );
    }
};
