const path = require("path");
const cds = require("@sap/cds");
const _ = require("lodash");
const Piscina = require("piscina");
const cliProgress = require("cli-progress");

const os = require("os");
const compileMetadata = require("./metaData");
const { ord } = require("./index");
const { BUILD_DEFAULT_PATH, ORD_SERVICE_NAME, ORD_DOCUMENT_FILE_NAME } = require("./constants");

module.exports = class OrdBuildPlugin extends cds.build.Plugin {
    static taskDefaults = { src: cds.env.folders.srv };

    init() {
        this.task.dest = this.task.dest ?? path.join(cds.root, BUILD_DEFAULT_PATH);
    }

    async build() {
        // @cap-js/graphql registers protocols and compile targets at runtime via cds-plugin.js,
        // but cds build rebuilds cds.env afterward, losing both registrations.
        // Re-apply so endpoints4() and cds.compile.to.graphql work during build.
        if ("@cap-js/graphql" in cds.env.plugins && !cds.env.protocols?.graphql) {
            cds.env.protocols.graphql = { path: "/graphql", impl: "@cap-js/graphql" };
            require("@cap-js/graphql/lib/api").registerCompileTargets();
        }

        return this.model()
            .then((model) => ({ model, document: ord(model) }))
            .then(({ model, document }) =>
                Promise.all([
                    this.write(this._postProcess(document)).to(ORD_DOCUMENT_FILE_NAME),
                    this._generateResourcesFiles(model, [
                        ...(document.apiResources || []),
                        ...(document.eventResources || []),
                    ]),
                ]),
            )
            .catch((error) => {
                throw new cds.build.BuildError(`ORD build failed: ${error.message}`);
            });
    }

    _createProgressBar() {
        return new cliProgress.SingleBar({
            format: "Processing resourcesFiles [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s",
            barCompleteChar: "█",
            barIncompleteChar: "░",
            stopOnComplete: true,
        });
    }

    _postProcess(document) {
        const clone = _.cloneDeep(document);

        [...(clone.apiResources || []), ...(clone.eventResources || [])]
            .flatMap((resource) => resource.resourceDefinitions || [])
            .forEach((resourceDefinition) => {
                resourceDefinition.url = this._createRelativePath(resourceDefinition.url);
            });

        return clone;
    }

    _createRelativePath(url) {
        let relative = url.split("/ord/v1").pop();
        if (relative.startsWith("/")) relative = relative.slice(1);
        return path.join(...relative.replace(/:/g, "_").split("/"));
    }

    _getCompileTasksCount(resources) {
        return resources
            .filter((resource) => !resource.ordId.includes(ORD_SERVICE_NAME))
            .map(({ resourceDefinitions }) => resourceDefinitions?.length || 0)
            .reduce((a, b) => a + b, 0);
    }

    _createWorkerPool(tasks, model) {
        if (tasks.length < 2) {
            // No need for worker pool if only one task - run in-process to avoid overhead of worker thread communication
            return {
                close: () => Promise.resolve(),
                run: ({ url }) => compileMetadata(url, model).then(({ response }) => response),
            };
        }

        const size = cds.cli?.options?.taskOptions?.workers || os.availableParallelism();
        const maxThreads = Math.ceil(Number(size) || os.availableParallelism() * Number(size.replace(/C$/i, "")));

        return new Piscina({
            minThreads: Math.min(tasks, maxThreads),
            filename: path.join(__dirname, "threads", "compile.js"),
            workerData: { model: JSON.parse(JSON.stringify(model)) },
            maxThreads: Math.min(tasks, maxThreads, Math.ceil(os.availableParallelism() * 1.5)),
        });
    }

    _generateResourcesFiles(model, resources) {
        const tasks = this._getCompileTasksCount(resources);
        const progressBar = this._createProgressBar();
        const pool = this._createWorkerPool(tasks, model);

        progressBar.start(tasks, 0);

        return Promise.all(
            resources
                .filter(({ resourceDefinitions }) => !!resourceDefinitions)
                .flatMap(({ ordId, resourceDefinitions }) =>
                    resourceDefinitions.map(({ url }) =>
                        pool.run({ url }).then((response) =>
                            this.write(response)
                                .to(path.join(ordId, url.split("/").pop()).replace(/:/g, "_"))
                                .then(() => progressBar.increment()),
                        ),
                    ),
                ),
        ).finally(() => {
            progressBar.stop();
            return pool.close({ force: true });
        });
    }
};
