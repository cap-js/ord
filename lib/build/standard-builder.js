const cds = require("@sap/cds");
const _ = require("lodash");

const defaults = require("../defaults.js");
const OrdBuilder = require("./ord-builder.js");
const { ord } = require("../index");
const { getCustomORDContent } = require("../extend-ord-with-custom");
const { ORD_DOCUMENT_FILE_NAME, DOCUMENT_PERSPECTIVES } = require("../constants");

module.exports = class StandardBuilder extends OrdBuilder {
    async build() {
        return this.model()
            .then((model) => {
                const extensions = [getCustomORDContent(cds?.env?.["ord"]?.customOrdContentFile)];

                return Promise.all([
                    this._generateResourcesFiles(model, ord(model), "."), // No extensions from custom ORD JSON here
                    this.write(this._postProcess(ord(model, extensions))).to(ORD_DOCUMENT_FILE_NAME),
                ]);
            })
            .catch((error) => {
                throw new cds.build.BuildError(`ORD build failed: ${error.message}`);
            });
    }

    _postProcess(document) {
        const clone = _.cloneDeep(document);

        [...(clone.apiResources || []), ...(clone.eventResources || [])]
            .flatMap((resource) => resource.resourceDefinitions || [])
            .forEach((rd) => {
                rd.url = rd.url.replace(/^\/ord\/v1\//, "").replace(/:/g, "_");
            });

        return defaults.adjustForPerspective(clone, DOCUMENT_PERSPECTIVES.SystemVersion);
    }
};
