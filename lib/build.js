const os = require("os");
const path = require("path");
const cds = require("@sap/cds");
const _ = require("lodash");
const cliProgress = require("cli-progress");

const { ord } = require("./index");
const { BUILD_DEFAULT_PATH, ORD_SERVICE_NAME, ORD_DOCUMENT_FILE_NAME } = require("./constants");
const WorkerPool = require("./threads/worker-pool");

module.exports = class OrdBuildPlugin extends cds.build.Plugin {
    static taskDefaults = { src: cds.env.folders.srv };

    init() {
        this.task.dest = this.task.dest ?? path.join(cds.root, BUILD_DEFAULT_PATH);
    }

    async build() {
        // @cap-js/graphql registers protocols and compile targets at runtime via cds-plugin.js,
        // but cds build rebuilds cds.env afterwards, losing both registrations.
        // Re-apply so endpoints4() and cds.compile.to.graphql work during build.
        if ("@cap-js/graphql" in cds.env.plugins && !cds.env.protocols?.graphql) {
            cds.env.protocols.graphql = { path: "/graphql", impl: "@cap-js/graphql" };
            require("@cap-js/graphql/lib/api").registerCompileTargets();
        }

        try {
            const model = await this.model();
            const document = ord(model);

            return Promise.all([
                this.write(this.postProcess(document)).to(ORD_DOCUMENT_FILE_NAME),
                this._generateResourcesFiles(model, [
                    ...(document.apiResources || []),
                    ...(document.eventResources || []),
                ]),
            ]);
        } catch (error) {
            throw new cds.build.BuildError(`ORD build failed: ${error.message}`);
        }
    }

    postProcess(ordDocument) {
        const clone = _.cloneDeep(ordDocument);

        [...(clone.apiResources || []), ...(clone.eventResources || [])]
            .flatMap((resource) => resource.resourceDefinitions || [])
            .forEach((resourceDefinition) => {
                resourceDefinition.url = this._createRelativePath(resourceDefinition.url);
            });

        return clone;
    }

    _createProgressBar() {
        return new cliProgress.SingleBar({
            format: "Processing resourcesFiles [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s",
            barCompleteChar: "█",
            barIncompleteChar: "░",
            stopOnComplete: true,
        });
    }

    _createRelativePath(url) {
        let relative = url.split("/ord/v1").pop();
        if (relative.startsWith("/")) relative = relative.slice(1);
        return path.join(...relative.replace(/:/g, "_").split("/"));
    }

    _countTotalFiles(resources) {
        return resources
            .filter((resource) => !resource.ordId.includes(ORD_SERVICE_NAME))
            .map(({ resourceDefinitions }) => resourceDefinitions?.length || 0)
            .reduce((a, b) => a + b, 0);
    }

    _generateResourcesFiles(model, resources) {
        const progressBar = this._createProgressBar();
        const totalFiles = this._countTotalFiles(resources);
        const cpus = os.availableParallelism ? os.availableParallelism() : os.cpus().length;
        const poolSize = Math.max(1, Math.min(Math.ceil(cpus / 2), totalFiles));
        // Pass model once per worker via workerData (not per task)
        const plainModel = JSON.parse(JSON.stringify(model));
        const pool = new WorkerPool(path.resolve(__dirname, "threads", "compile.js"), poolSize, { model: plainModel });

        progressBar.start(totalFiles, 0);

        return Promise.allSettled(
            resources
                .filter(({ resourceDefinitions }) => !!resourceDefinitions)
                .flatMap(({ ordId, resourceDefinitions }) =>
                    resourceDefinitions.map(({ url }) =>
                        pool.exec({ url }).then(({ response }) =>
                            this.write(response)
                                .to(path.join(ordId, url.split("/").pop()).replace(/:/g, "_"))
                                .then(() => progressBar.increment()),
                        ),
                    ),
                ),
        )
            .then((results) => {
                const errors = results.filter((r) => r.status === "rejected").map((r) => r.reason);
                if (errors.length) throw errors[0];
            })
            .finally(async () => {
                progressBar.stop();
                await pool.destroy();
            });
    }
};
