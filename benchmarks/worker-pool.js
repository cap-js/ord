/**
 * Minimal worker thread pool using Node.js built-in worker_threads.
 * Zero external dependencies.
 */
const { Worker } = require("worker_threads");

class WorkerPool {
    #workers;
    #queue = [];

    /**
     * @param {string} script  - Path to the worker script
     * @param {number} size    - Number of worker threads
     * @param {object} workerData - Data passed once to each worker at creation
     */
    constructor(script, size, workerData) {
        this.#workers = Array.from({ length: size }, () => {
            const w = new Worker(script, { workerData });
            w.idle = true;
            return w;
        });
    }

    /**
     * Send data to an available worker and return a Promise with the result.
     * If all workers are busy, the task is queued.
     */
    exec(data) {
        return new Promise((resolve, reject) => {
            const worker = this.#workers.find((w) => w.idle);
            if (worker) this.#run(worker, data, resolve, reject);
            else this.#queue.push({ data, resolve, reject });
        });
    }

    #run(worker, data, resolve, reject) {
        worker.idle = false;
        const onMsg = (result) => {
            worker.removeListener("error", onErr);
            worker.idle = true;
            if (result.error) reject(new Error(result.error));
            else resolve(result);
            const next = this.#queue.shift();
            if (next) this.#run(worker, next.data, next.resolve, next.reject);
        };
        const onErr = (err) => {
            worker.removeListener("message", onMsg);
            worker.idle = true;
            reject(err);
            const next = this.#queue.shift();
            if (next) this.#run(worker, next.data, next.resolve, next.reject);
        };
        worker.once("message", onMsg);
        worker.once("error", onErr);
        worker.postMessage(data);
    }

    async destroy() {
        await Promise.all(this.#workers.map((w) => w.terminate()));
    }
}

module.exports = WorkerPool;
