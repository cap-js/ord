const cds = require("@sap/cds");
const cds_dk = require("@sap/cds-dk");
const path = require("path");
const _ = require("lodash");
const { getMetadata } = require("./index");
const { generateOrd } = require("./generateOrd");
const cliProgress = require("cli-progress");
const { BUILD_DEFAULT_PATH, ORD_SERVICE_NAME, ORD_DOCUMENT_FILE_NAME } = require("./constants");
const { Logger } = require("./logger");

module.exports = class OrdBuildPlugin extends cds_dk.build.Plugin {
    static taskDefaults = { src: cds.env.folders.srv };

    init() {
        if (this.task.dest === undefined) {
            this.task.dest = path.join(cds.root, BUILD_DEFAULT_PATH);
        }
    }

    async _writeResourcesFiles(resObj, model, promises) {
        let totalFiles = resObj.reduce((total, resource) => {
            if (!resource.ordId.includes(ORD_SERVICE_NAME) && resource.resourceDefinitions) {
                return total + resource.resourceDefinitions.length;
            }
            return total;
        }, 0);

        const progressBar = new cliProgress.SingleBar({
            format: "Processing resourcesFiles [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s",
            barCompleteChar: "█",
            barIncompleteChar: "░",
            stopOnComplete: true,
        });

        let warnings = [];
        let completed = 0;
        progressBar.start(totalFiles, 0);

        try {
            for (const resource of resObj) {
                if (resource.ordId.includes(ORD_SERVICE_NAME) || !resource.resourceDefinitions) continue;
                for (const resourceDefinition of resource.resourceDefinitions) {
                    try {
                        const { _, response } = await getMetadata(resourceDefinition.url, model); // eslint-disable-line no-unused-vars
                        const fileName = path
                            .join(resource.ordId, resourceDefinition.url.split("/").pop())
                            .replace(/:/g, "_");
                        promises.push(
                            this.write(response)
                                .to(fileName)
                                .catch((err) => {
                                    warnings.push(`Error writing file ${fileName}: ${err.message}`);
                                }),
                        );
                        completed++;
                        progressBar.update(completed);
                    } catch (error) {
                        completed++;
                        progressBar.update(completed);
                        warnings.push(`Error getting metadata for ${resourceDefinition.url}: ${error.message}`);
                    } finally {
                        completed++;
                        progressBar.update(completed);
                    }
                }
            }
            await Promise.all(promises);
        } catch (error) {
            warnings.push("Failed to process resources: " + error.message);
            throw error;
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

        // Generate complete ORD document with all enrichments (including Integration Dependencies)
        const ordDocument = generateOrd(model, { mode: "build" });

        // Post-process (update resource URLs for static file generation)
        const postProcessedOrdDocument = this.postProcess(ordDocument);

        const promises = [];
        promises.push(this.write(postProcessedOrdDocument).to(ORD_DOCUMENT_FILE_NAME));

        if (ordDocument.apiResources && ordDocument.apiResources.length > 0) {
            await this._writeResourcesFiles(ordDocument.apiResources, model, promises);
        }

        if (ordDocument.eventResources && ordDocument.eventResources.length > 0) {
            await this._writeResourcesFiles(ordDocument.eventResources, model, promises);
        }
        return Promise.all(promises);
    }
};
