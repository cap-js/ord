const cds = require("@sap/cds");
const cds_dk = require("@sap/cds-dk");
const path = require("path");
const fs = require("fs");
const _ = require("lodash");
const { ord, getMetadata } = require("./index");
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

    _loadAppYaml() {
        const appYamlPath = path.join(cds.root, "app.yaml");

        if (!cds.utils.exists(appYamlPath)) {
            Logger.log("No app.yaml found in project root, skipping Integration Dependency generation");
            return null;
        }

        try {
            Logger.log(`Loading app.yaml from ${appYamlPath}`);
            const yaml = require("js-yaml");
            const appYamlContent = fs.readFileSync(appYamlPath, "utf8");
            const appFoundationConfig = yaml.load(appYamlContent);
            Logger.log("Successfully loaded app.yaml configuration");
            return appFoundationConfig;
        } catch (error) {
            Logger.error(`Error loading app.yaml: ${error.message}`);
            return null;
        }
    }

    _handleIntegrationDependency(ordDocument, appFoundationConfig) {
        // If no consumption config, return false
        if (!appFoundationConfig?.overrides?.dataProducts?.consumption) {
            return false;
        }

        Logger.log("Processing Integration Dependencies from app.yaml");

        // Generate Integration Dependencies
        const { generateIntegrationDependencies } = require("./integrationDependency");

        try {
            // Extract package IDs from existing packages
            const packageIds = ordDocument.packages?.map((pkg) => pkg.ordId) || [];

            // Create minimal appConfig needed for generation
            const appConfig = {
                ordNamespace: packageIds[0]?.split(":")[0] || "customer.unknown",
            };

            const integrationDependencies = generateIntegrationDependencies(appFoundationConfig, appConfig, packageIds);

            if (integrationDependencies.length) {
                // Mutate in place - add Integration Dependencies directly to the document
                ordDocument.integrationDependencies = integrationDependencies;
                Logger.log(
                    `Added ${integrationDependencies.length} Integration Dependenc${integrationDependencies.length === 1 ? "y" : "ies"} to ORD document`,
                );
                return true;
            }
        } catch (error) {
            Logger.error(`Failed to generate Integration Dependencies: ${error.message}`);
        }

        return false;
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

        // Generate base ORD document from CDS model
        const ordDocument = ord(model);

        // Load app.yaml and handle Integration Dependencies if it exists
        if (cds.utils.exists(path.join(cds.root, "app.yaml"))) {
            const appFoundationConfig = this._loadAppYaml();

            // Only proceed if app.yaml was successfully loaded
            if (appFoundationConfig) {
                const hasIntegrationDependencies = this._handleIntegrationDependency(
                    ordDocument,
                    appFoundationConfig,
                );

                if (hasIntegrationDependencies) {
                    Logger.log("Integration Dependencies successfully added to ORD document");
                }
            }
        }

        // Post-process (update resource URLs)
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
