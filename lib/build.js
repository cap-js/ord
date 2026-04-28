const path = require("path");
const cds = require("@sap/cds");
const _ = require("lodash");
const Piscina = require("piscina");
const cliProgress = require("cli-progress");

const os = require("os");
const { ord } = require("./index");
const registerCompileTargets = require("./common/register-compile-targets");
const { BUILD_DEFAULT_PATH, ORD_DOCUMENT_FILE_NAME } = require("./constants");

module.exports = class OrdBuildPlugin extends cds.build.Plugin {
    static taskDefaults = { src: cds.env.folders.srv };

    init() {
        this.task.dest = this.task.dest ?? path.join(cds.root, BUILD_DEFAULT_PATH);
    }

    async build() {
        registerCompileTargets();

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

    _createWorkerPool(tasks, model) {
        const size = cds.cli?.options?.taskOptions?.workers || os.availableParallelism();
        const maxThreads = Math.ceil(Number(size) || os.availableParallelism() * Number(size.replace(/C$/i, "")));

        return new Piscina({
            filename: path.join(__dirname, "threads", "compile.js"),
            workerData: { model: JSON.parse(JSON.stringify(model)) },
            minThreads: Math.min(tasks, maxThreads, Math.ceil(os.availableParallelism() * 1.5)),
            maxThreads: Math.min(tasks, maxThreads, Math.ceil(os.availableParallelism() * 1.5)),
        });
    }

    _extractCompileTasks(resources) {
        return resources
            .filter(({ resourceDefinitions }) => !!resourceDefinitions)
            .flatMap(({ ordId, resourceDefinitions }) => resourceDefinitions.map(({ url }) => ({ url, ordId })));
    }

    _generateResourcesFiles(model, resources) {
        const progressBar = this._createProgressBar();
        const tasks = this._extractCompileTasks(resources);
        const pool = !tasks.length ? null : this._createWorkerPool(tasks.length, model);

        progressBar.start(tasks.length, 0);

        return Promise.all(
            tasks.map(({ url, ordId }) =>
                pool.run({ url }).then((response) =>
                    this.write(response)
                        .to(path.join(ordId, url.split("/").pop()).replace(/:/g, "_"))
                        .then(() => progressBar.increment()),
                ),
            ),
        ).finally(() => {
            progressBar.stop();
            return pool?.close({ force: true });
        });
    }
};
