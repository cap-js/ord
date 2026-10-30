const path = require("path");
const cds = require("@sap/cds");
const _ = require("lodash");

const defaults = require("../defaults.js");
const OrdBuilder = require("./ord-builder.js");
const { ord } = require("../index");
const { getCustomORDContent } = require("../extend-ord-with-custom");
const { DOCUMENT_PERSPECTIVES } = require("../constants");
const Configuration = require("../configuration");

module.exports = class StaticContentBuilder extends OrdBuilder {
    async build() {
        return this.model()
            .then((model) => {
                const config = new Configuration(model);
                const document = defaults.adjustForPerspective(
                    ord(model, [getCustomORDContent(cds?.env?.["ord"]?.customOrdContentFile)]),
                    DOCUMENT_PERSPECTIVES.SystemVersion,
                );

                return Promise.all([
                    this._writeMainOrd(config, document),
                    this._writePackageOrd(config, document),
                    this._writeApiResources(config, document),
                    this._writeEventResources(config, document),
                    this._generateResourcesFiles(model, ord(model), config.ordNamespace), // No extensions from custom ORD JSON here
                ]);
            })
            .catch((error) => {
                throw new cds.build.BuildError(`ORD build failed: ${error.message}`);
            });
    }

    _writeMainOrd(config, document) {
        return this.write({
            lastUpdate: config.lastUpdate,
            ..._.omit(document, ["packages", "apiResources", "eventResources"]),
        }).to("main.ord.json");
    }

    _adjustResource(resource) {
        return {
            ...resource,
            resourceDefinitions: resource.resourceDefinitions.map((rd) => ({
                ...rd,
                url: `./${rd.url.split("/").pop()}`,
            })),
        };
    }

    _writePackageOrd(config, document) {
        return (
            document?.packages?.length &&
            this.write(_.pick(document, ["packages", "policyLevels", "openResourceDiscovery"])).to(
                path.join(config.ordNamespace, "package.ord.json"),
            )
        );
    }

    _writeApiResources(config, document) {
        return Promise.all(
            (document.apiResources ?? []).map((resource) =>
                this.write({
                    openResourceDiscovery: document.openResourceDiscovery,
                    apiResources: [this._adjustResource(resource)],
                }).to(path.join(config.ordNamespace, resource.ordId.replace(/:/g, "_"), "ord.json")),
            ),
        );
    }

    _writeEventResources(config, document) {
        return Promise.all(
            (document.eventResources ?? []).map((resource) =>
                this.write({
                    openResourceDiscovery: document.openResourceDiscovery,
                    eventResources: [this._adjustResource(resource)],
                }).to(path.join(config.ordNamespace, resource.ordId.replace(/:/g, "_"), "ord.json")),
            ),
        );
    }
};
