const cds = require("@sap/cds");
const path = require("path");
const _ = require("lodash");
const Logger = require("../logger");
const {
    CDS_ELEMENT_KIND,
    CONTENT_MERGE_KEY,
    ENTITY_RELATIONSHIP_ANNOTATION,
    ORD_EXTENSIONS_PREFIX,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
} = require("../constants");
const { resolveApiResourceProtocol } = require("../protocol-resolver");
const { getCustomORDContent } = require("../extend-ord-with-custom");
const { collectExternalServices } = require("../integration-dependency");
const { getRFC3339Date } = require("../date");
const { createEntityTypeMappingsItemTemplate, isPrimaryDataProductService } = require("../templates");

function parse(csn, extensions = []) {
    const linkedCsn = _propagateORDVisibility(cds.linked(csn));
    const config = _buildConfig(linkedCsn);
    const services = _collectServices(linkedCsn, config);
    const entities = _collectEntities(linkedCsn, config);
    const externalServices = collectExternalServices(linkedCsn);
    const customOrd = getCustomORDContent(config);

    return { config, services, entities, externalServices, customOrd, extensions };
}

function _buildConfig(linkedCsn) {
    const packageJson = _loadPackageJson();
    const packageName = packageJson.name;
    const appName = packageName.replace(/^[@]/, "").replace(/[@/]/g, "-");
    const env = cds.env["ord"];
    const ordNamespace = env?.namespace || `customer.${packageName.replace(/[^a-zA-Z0-9]/g, "")}`;
    const internalNamespace = env?.internalNamespace;
    const eventApplicationNamespace = cds.env?.export?.asyncapi?.applicationNamespace;

    if (eventApplicationNamespace && ordNamespace !== eventApplicationNamespace) {
        Logger.warn("ORD and AsyncAPI namespaces should be the same.");
    }

    return {
        env,
        lastUpdate: getRFC3339Date(),
        appName,
        ordNamespace,
        internalNamespace,
        eventApplicationNamespace,
        packageName,
    };
}

function _loadPackageJson() {
    const packageJsonPath = path.join(cds.root, "package.json");
    if (!cds.utils.exists(packageJsonPath)) {
        throw new Error("package.json not found in the project root directory");
    }
    return require(packageJsonPath);
}

function _collectServices(linkedCsn, config) {
    const services = [];
    const eventServiceNames = new Set();

    for (const [name, definition] of Object.entries(linkedCsn.definitions)) {
        if (_isBlockedServiceName(name)) continue;

        if (definition.kind === CDS_ELEMENT_KIND.event) {
            const parentService = _findParentService(linkedCsn, name);
            if (parentService) eventServiceNames.add(parentService);
        }
    }

    for (const [name, definition] of Object.entries(linkedCsn.definitions)) {
        if (!_isValidService(name, definition)) continue;
        if (_shouldSkipIfServiceOnlyContainsEvents(definition)) continue;

        const protocols = resolveApiResourceProtocol(name, definition, {
            isPrimaryDataProduct: isPrimaryDataProductService,
        });
        const extensions = _readORDExtensions(definition);
        const hasEvents = eventServiceNames.has(name);

        services.push({ name, definition, protocols, extensions, hasEvents });
    }

    // Also collect event-only services (services that only have events, no entities/actions)
    for (const eventServiceName of eventServiceNames) {
        if (!services.some((s) => s.name === eventServiceName)) {
            const definition = linkedCsn.definitions[eventServiceName];
            if (definition && _isValidService(eventServiceName, definition)) {
                const extensions = _readORDExtensions(definition);
                services.push({
                    name: eventServiceName,
                    definition,
                    protocols: [],
                    extensions,
                    hasEvents: true,
                    eventOnly: true,
                });
            }
        }
    }

    return services;
}

function _collectEntities(linkedCsn, config) {
    const entityTypeTargets = [];

    for (const [name, definition] of Object.entries(linkedCsn.definitions)) {
        if (name.includes(".texts")) continue;
        if (definition.kind !== CDS_ELEMENT_KIND.entity) continue;
        if (!_shouldNotSkipIfServiceProtocolIsNone(definition)) continue;

        if (definition[ORD_ODM_ENTITY_NAME_ANNOTATION] || definition[ENTITY_RELATIONSHIP_ANNOTATION]) {
            const mapping = createEntityTypeMappingsItemTemplate(definition);
            if (Array.isArray(mapping)) entityTypeTargets.push(...mapping);
            else if (mapping) entityTypeTargets.push(mapping);
        }
    }

    return _.uniqBy(entityTypeTargets, CONTENT_MERGE_KEY);
}

function _findParentService(linkedCsn, eventName) {
    const serviceNames = Object.keys(linkedCsn.definitions).filter(
        (key) => linkedCsn.definitions[key].kind === CDS_ELEMENT_KIND.service,
    );
    for (const serviceName of serviceNames) {
        if (eventName.startsWith(serviceName + ".")) return serviceName;
    }
    return null;
}

function _isBlockedServiceName(key) {
    return ["cds.xt.MTXServices", "MtxOrdProviderService", "OpenResourceDiscoveryService"].some((blocked) =>
        key.includes(blocked),
    );
}

function _isValidService(key, definition) {
    const isExternalService = Object.keys(cds).includes("requires") ? Object.keys(cds.requires).includes(key) : false;
    return (
        definition.kind === CDS_ELEMENT_KIND.service &&
        !definition["@cds.external"] &&
        definition["@protocol"] !== "none" &&
        !isExternalService &&
        !_isBlockedServiceName(key)
    );
}

function _shouldSkipIfServiceOnlyContainsEvents(definition) {
    const noActions = !definition.actions || Object.keys(definition.actions).length === 0;
    const noFunctions = !definition.functions || Object.keys(definition.functions).length === 0;
    const noEntities = !definition.entities || Object.keys(definition.entities).length === 0;
    const hasEvents = definition.events && Object.keys(definition.events).length > 0;
    return noActions && noFunctions && noEntities && hasEvents;
}

function _shouldNotSkipIfServiceProtocolIsNone(definition) {
    if (definition["_service"] && definition["_service"]["@protocol"] === "none") return false;
    return true;
}

function _readORDExtensions(model) {
    const ordExtensions = {};
    for (const key in model) {
        if (key.startsWith(ORD_EXTENSIONS_PREFIX)) {
            const ordKey = key.replace(ORD_EXTENSIONS_PREFIX, "");
            ordExtensions[ordKey] = model[key];
        }
    }
    return _unflatten(ordExtensions);
}

function _unflatten(flatObject) {
    let result = {};
    Object.keys(flatObject).forEach((key) => {
        _.set(result, key, flatObject[key]);
    });
    return result;
}

function _propagateORDVisibility(model) {
    for (const [name, def] of Object.entries(model.definitions)) {
        if (def.kind === CDS_ELEMENT_KIND.service && def[ORD_EXTENSIONS_PREFIX + "visibility"]) {
            const serviceVisibility = def[ORD_EXTENSIONS_PREFIX + "visibility"];
            for (const childDef of model.definitions) {
                if (childDef.name.startsWith(name + ".") && !childDef[ORD_EXTENSIONS_PREFIX + "visibility"]) {
                    childDef[ORD_EXTENSIONS_PREFIX + "visibility"] = serviceVisibility;
                }
            }
        }
    }
    return model;
}

module.exports = { parse };
