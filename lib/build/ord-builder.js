const os = require("os");
const path = require("path");
const cds = require("@sap/cds");
const Piscina = require("piscina");
const cliProgress = require("cli-progress");

const { localize } = require("../common/utils");
const { BUILD_DEFAULT_PATH } = require("../constants");
const registerCompileTargets = require("../common/register-compile-targets");

const StandardBuilder = require("./standard-builder");
const StaticContentBuilder = require("./static-content-builder");

module.exports = class OrdBuilder extends cds.build.Plugin {
    static taskDefaults = { src: cds.env.folders.srv };

    init() {
        this.task.dest = this.task.dest ?? path.join(cds.root, BUILD_DEFAULT_PATH);
    }

    async build() {
        switch (cds.cli?.options?.taskOptions?.strategy ?? "standard") {
            case "standard":
                return new StandardBuilder(this).build();
            case "static-content":
                return new StaticContentBuilder(this).build();
            default:
                throw new Error(`Invalid strategy: ${cds.cli?.options?.taskOptions?.strategy}`);
        }
    }

    _createProgressBar() {
        return new cliProgress.SingleBar({
            format: "Processing resourcesFiles [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s",
            barCompleteChar: "█",
            barIncompleteChar: "░",
            stopOnComplete: true,
        });
    }

    _extractCompileTasks(document) {
        return [...(document.apiResources ?? []), ...(document.eventResources ?? [])]
            .filter(({ resourceDefinitions }) => !!resourceDefinitions)
            .flatMap(({ ordId, resourceDefinitions }) => resourceDefinitions.map(({ url }) => ({ url, ordId })));
    }

    _createWorkerPool(tasks, model) {
        const size = cds.cli?.options?.taskOptions?.workers || os.availableParallelism();
        const maxThreads = Math.ceil(Number(size) || os.availableParallelism() * Number(size.replace(/C$/i, "")));

        return new Piscina({
            filename: path.join(__dirname, "..", "threads", "compile.js"),
            workerData: { model: JSON.parse(JSON.stringify(model)) },
            minThreads: Math.min(tasks, maxThreads, Math.ceil(os.availableParallelism() * 1.5)),
            maxThreads: Math.min(tasks, maxThreads, Math.ceil(os.availableParallelism() * 1.5)),
        });
    }

    _generateResourcesFiles(model, document, base) {
        const progressBar = this._createProgressBar();
        const tasks = this._extractCompileTasks(document);
        const pool = !tasks.length ? null : this._createWorkerPool(tasks.length, model);

        progressBar.start(tasks.length, 0);

        return Promise.all(
            tasks.map(({ url, ordId }) =>
                pool.run({ url }).then((response) =>
                    this.write(localize(model, response))
                        .to(path.join(base, ordId.replace(/:/g, "_"), url.split("/").pop()))
                        .then(() => progressBar.increment()),
                ),
            ),
        ).finally(() => {
            progressBar.stop();
            return pool?.close({ force: true });
        });
    }
};
