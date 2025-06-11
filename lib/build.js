const cds = require("@sap/cds");
const cds_dk = require("@sap/cds-dk");
const path = require("path");
const _ = require("lodash");
const { ord, getMetadata } = require("./index");
const { BUILD_DEFAULT_PATH, ORD_SERVICE_NAME, ORD_DOCUMENT_FILE_NAME } = require("./constants");

module.exports = class OrdBuildPlugin extends cds_dk.build.Plugin {
    static taskDefaults = { src: cds.env.folders.srv };

    init() {
        this.task.dest = path.join(cds.root, BUILD_DEFAULT_PATH);
    }

    async _writeResourcesFiles(resObj, model, promises) {
        for (const resource of resObj) {
            if (resource.ordId.includes(ORD_SERVICE_NAME) || !resource.resourceDefinitions) {
                continue;
            }

            for (const resourceDefinition of resource.resourceDefinitions) {
                const url = resourceDefinition.url;
                const fileName = path.join(resource.ordId, url.split("/").pop());
                try {
                    const { _, response } = await getMetadata(url, model); // eslint-disable-line no-unused-vars
                    promises.push(
                        this.write(response)
                            .to(fileName.replace(/:/g, "_"))
                            .catch((err) => {
                                console.log("Error", `Failed to write file ${fileName}: ${err.message}`);
                            }),
                    );
                } catch (error) {
                    console.log("Error", `Failed to get metadata for ${url}: ${error.message}`);
                }
            }
        }
    }

    postProcess(ordDocument) {
        const clonedOrdDocument = _.cloneDeep(ordDocument);
        const _updateResourceUrls = (resources) => {
            for (const resource of resources || []) {
                if (resource.resourceDefinitions) {
                    for (const resourceDefinition of resource.resourceDefinitions) {
                        let url = resourceDefinition.url;
                        url = this._createRelativePath(url);
                        resourceDefinition.url = url;
                    }
                }
            }
        };

        _updateResourceUrls(clonedOrdDocument.apiResources);
        _updateResourceUrls(clonedOrdDocument.eventResources);

        return clonedOrdDocument;
    }

    _createRelativePath(url) {
        let relative = url.split("/ord/v1").pop();
        if (relative.startsWith("/")) relative = relative.slice(1);
        relative = relative.replace(/:/g, "_");
        return path.join(...relative.split("/"));
    }

    async build() {
        const model = await this.model();
        const ordDocument = ord(model);
        const postProcessedOrdDocument = this.postProcess(ordDocument);

        const promises = [];
        promises.push(this.write(postProcessedOrdDocument).to(ORD_DOCUMENT_FILE_NAME));

        await this._writeResourcesFiles(ordDocument.apiResources, model, promises);
        await this._writeResourcesFiles(ordDocument.eventResources, model, promises);

        return Promise.all(promises);
    }
};
