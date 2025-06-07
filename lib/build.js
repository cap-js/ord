const cds = require("@sap/cds");
const cds_dk = require("@sap/cds-dk");
const { path } = cds.utils;
const { ord, getMetadata } = require("./index");
const { BUILD_DEFAULT_PATH, ORD_SERVICE_NAME, ORD_DOCUMENT_FILE_NAME } = require("./constants");

module.exports = class OrdBuildPlugin extends cds_dk.build.Plugin {
    static taskDefaults = { src: cds.env.folders.srv };

    init() {
        this.task.dest = path.join(cds.root, BUILD_DEFAULT_PATH);
    }

    async _writeResourcesFiles(resObj, model, promises) {
        for (const resource of resObj || []) {
            if (resource.ordId.includes(ORD_SERVICE_NAME) || !resource.resourceDefinitions) {
                continue;
            }

            const subDir = path.join(this.task.dest, resource.ordId);

            for (const resourceDefinition of resource.resourceDefinitions) {
                const url = resourceDefinition.url;
                const fileName = url.split("/").pop();
                try {
                    const { _, response } = await getMetadata(url, model); // eslint-disable-line no-unused-vars
                    promises.push(
                        this.write(response)
                            .to(path.join(subDir, fileName))
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

    async build() {
        const model = await this.model();
        const ordDocument = ord(model);

        const promises = [];
        promises.push(this.write(ordDocument).to(ORD_DOCUMENT_FILE_NAME));

        await this._writeResourcesFiles(ordDocument.apiResources, model, promises);
        await this._writeResourcesFiles(ordDocument.eventResources, model, promises);

        return Promise.all(promises);
    }
};
