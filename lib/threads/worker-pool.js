const { cpus } = require("os");
const { Worker } = require("worker_threads");
const { EventEmitter } = require("node:events");

class PooledWorker {
    constructor(id, emitter, { script, options }) {
        this._id = id;
        this._emitter = emitter;
        this._worker = new Worker(script, options).once("online", () => this._emitter.emit("ready", this));
    }

    process({ data, resolve, reject }) {
        this._worker //
            .once("message", (result) => {
                this._worker.removeAllListeners("error");
                this._emitter.emit("ready", this);
                resolve(result);
            })
            .once("error", (error) => {
                this._worker.removeAllListeners("message");
                this._emitter.emit("failed", this._id);
                reject(error);
            })
            .postMessage(data);
    }

    terminate() {
        return this._worker.terminate();
    }
}

module.exports = class {
    /**
     * @param {number|string} size - Number of worker threads (1, '0.5c', '2.5c' etc.)
     * @param {string} script  - Path to the worker script
     * @param {object} options - Options passed to each worker at creation
     */
    constructor(size, script, options) {
        this._ready = [];
        this._tasks = [];
        this._workers = new Map();
        this._size = Math.ceil(Number(size) || cpus().length * Number(size.replace(/C$/i, "")));
        this._emitter = new EventEmitter() //
            .on("failed", (id) => {
                this._workers.set(id, new PooledWorker(id, this._emitter, { script, options }));
            })
            .on("ready", (worker) => {
                this._ready.push(worker);
                this._tasks.length && this._ready.shift().process(this._tasks.shift());
            })
            .on("submit", (task) => {
                this._tasks.push(task);
                this._ready.shift()?.process(this._tasks.shift());
                this._tasks.length &&
                    this._size > this._workers.size &&
                    this._workers.set(
                        this._workers.size,
                        new PooledWorker(this._workers.size, this._emitter, { script, options }),
                    );
            });
    }

    submit(data) {
        return new Promise((resolve, reject) => this._emitter.emit("submit", { data, resolve, reject }));
    }

    async terminate() {
        this._emitter.removeAllListeners();
        this._emitter.on("submit", ({ reject }) => reject(new Error("WorkerPool terminated")));
        this._tasks.forEach(({ reject }) => reject(new Error("WorkerPool terminated")));

        await Promise.all(Array.from(this._workers.values()).map((worker) => worker.terminate()));
    }
};
