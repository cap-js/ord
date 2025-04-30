const cds = require("@sap/cds");
const { path } = cds.utils
const { ord, getMetadata } = require('./index');

module.exports = class OrdBuildPlugin extends cds.build.Plugin {

    static taskDefaults = { src: cds.env.folders.srv }

    init() {
        this.task.dest = path.join(cds.root, 'gen/ord')
    }

    async _writeResourcesFiles(resObj, model, promises) {
        for (const resource of resObj) {

            if (resource.ordId.includes('OpenResourceDiscoveryService') || !resource.resourceDefinitions) {
                continue;
            }

            const subDir = path.join(this.task.dest, resource.ordId)

            for (const resourceDefinition of resource.resourceDefinitions) {
                const url = resourceDefinition.url;
                const fileName = url.split('/').pop();
                try {
                    const { _, response } = await getMetadata(url, model); // eslint-disable-line no-unused-vars
                    promises.push(
                        this.write(response).to(path.join(subDir, fileName)).catch(err => {
                            console.log("Error", `Failed to write file ${fileName}: ${err.message}`);
                        })
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

        const promises = []
        promises.push(
            this.write(ordDocument).to('ord-document.json')
        )

        await this._writeResourcesFiles(ordDocument.apiResources, model, promises)
        await this._writeResourcesFiles(ordDocument.eventResources, model, promises)

        return Promise.all(promises)
    }
}
