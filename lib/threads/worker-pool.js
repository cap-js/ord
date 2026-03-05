const { Worker } = require("worker_threads");

class WorkerPool {
    /**
     * @param {string} script  - Path to the worker script
     * @param {number} size    - Number of worker threads
     * @param {object} workerData - Data passed once to each worker at creation
     */
    constructor(script, size, workerData) {
        this._script = script;
        this._workerData = workerData;
        this._workers = Array.from({ length: size }, () => this._createWorker());
        this._queue = [];
    }

    _createWorker() {
        const w = new Worker(this._script, { workerData: this._workerData });
        w.idle = true;
        return w;
    }

    exec(data) {
        return new Promise((resolve, reject) => {
            const worker = this._workers.find((w) => w.idle);
            if (worker) this._dispatch(worker, data, resolve, reject);
            else this._queue.push({ data, resolve, reject });
        });
    }

    _dispatch(worker, data, resolve, reject) {
        worker.idle = false;
        const onMsg = (result) => {
            worker.removeListener("error", onErr);
            worker.idle = true;
            if (result.error) reject(new Error(result.error));
            else resolve(result);
            this._drainNext(worker);
        };
        const onErr = (err) => {
            worker.removeListener("message", onMsg);
            // Worker is dead after "error" event — remove and replace it
            const idx = this._workers.indexOf(worker);
            if (idx !== -1) {
                this._workers[idx] = this._createWorker();
                this._drainNext(this._workers[idx]);
            }
            reject(err);
        };
        worker.once("message", onMsg);
        worker.once("error", onErr);
        worker.postMessage(data);
    }

    _drainNext(worker) {
        const next = this._queue.shift();
        if (next) this._dispatch(worker, next.data, next.resolve, next.reject);
    }

    async destroy() {
        await Promise.all(this._workers.map((w) => w.terminate()));
    }
}

module.exports = WorkerPool;
