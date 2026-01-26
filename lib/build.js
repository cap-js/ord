const cds = require("@sap/cds");
const path = require("path");
const _ = require("lodash");
const { ord, getMetadata } = require("./index");
const cliProgress = require("cli-progress");
const { BUILD_DEFAULT_PATH, ORD_SERVICE_NAME, ORD_DOCUMENT_FILE_NAME } = require("./constants");
const { isMCPPluginInPackageJson } = require("./mcpAdapter");

const { BuildError } = cds.build;

module.exports = class OrdBuildPlugin extends cds.build.Plugin {
    static taskDefaults = { src: cds.env.folders.srv };

    init() {
        if (this.task.dest === undefined) {
            this.task.dest = path.join(cds.root, BUILD_DEFAULT_PATH);
        }
    }

    _createProgressBar(totalFiles) {
        const progressBar = new cliProgress.SingleBar({
            format: "Processing resourcesFiles [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s",
            barCompleteChar: "█",
            barIncompleteChar: "░",
            stopOnComplete: true,
        });
        progressBar.start(totalFiles, 0);
        return progressBar;
    }

    _countTotalFiles(resObj) {
        return resObj.reduce((total, resource) => {
            if (!resource.ordId.includes(ORD_SERVICE_NAME) && resource.resourceDefinitions) {
                return total + resource.resourceDefinitions.length;
            }
            return total;
        }, 0);
    }

    async _writeResourcesFiles(resObj, model, promises) {
        const totalFiles = this._countTotalFiles(resObj);
        const progressBar = this._createProgressBar(totalFiles);
        let completed = 0;

        try {
            for (const resource of resObj) {
                const shouldGenerate = resource.resourceDefinitions || isMCPPluginInPackageJson();
                if (!shouldGenerate) continue;

                for (const resourceDefinition of resource.resourceDefinitions) {
                    const { _, response } = await getMetadata(resourceDefinition.url, model); // eslint-disable-line no-unused-vars
                    const fileName = path
                        .join(resource.ordId, resourceDefinition.url.split("/").pop())
                        .replace(/:/g, "_");
                    promises.push(this.write(response).to(fileName));
                    progressBar.update(++completed);
                }
            }
            await Promise.all(promises);
        } finally {
            progressBar.stop();
        }
    }

    postProcess(ordDocument) {
        const clonedOrdDocument = _.cloneDeep(ordDocument);
        const _updateResourceUrls = (resources) => {
            for (const resource of resources || []) {
                if (resource.resourceDefinitions) {
                    for (const resourceDefinition of resource.resourceDefinitions) {
                        resourceDefinition.url = this._createRelativePath(resourceDefinition.url);
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
        return path.join(...relative.replace(/:/g, "_").split("/"));
    }

    async build() {
        try {
            const model = await this.model();
            const ordDocument = ord(model);
            const postProcessedOrdDocument = this.postProcess(ordDocument);

            const promises = [];
            promises.push(this.write(postProcessedOrdDocument).to(ORD_DOCUMENT_FILE_NAME));

            if (ordDocument.apiResources?.length > 0) {
                await this._writeResourcesFiles(ordDocument.apiResources, model, promises);
            }

            if (ordDocument.eventResources?.length > 0) {
                await this._writeResourcesFiles(ordDocument.eventResources, model, promises);
            }

            return Promise.all(promises);
        } catch (error) {
            throw new BuildError(`ORD build failed: ${error.message}`);
        }
    }
};
