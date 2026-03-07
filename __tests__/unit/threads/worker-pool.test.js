const WorkerPool = require("../../../lib/threads/worker-pool");

const script = `
const { parentPort } = require("worker_threads");

parentPort.on("message", (data) => {
    if(data % 2) throw new Error(data);
    parentPort.postMessage(data);
});
`;

describe("worker-pool", () => {
    it("should execute all tasks even when some fail", async () => {
        const pool = new WorkerPool(1, script, { eval: true });
        const datas = Array.from({ length: 10 }, (_, idx) => idx);
        const results = await Promise.allSettled(datas.map((data) => pool.submit(data)));

        await pool.terminate();

        expect(results).toEqual(datas.map((data) => {
            return data % 2 === 0
                ? { status: "fulfilled", value: data }
                : { status: "rejected", reason: new Error(data) };
        }));
    });

    it("should reject pending tasks after destroy", async () => {
        const pool = new WorkerPool("0", script, { eval: true });
        const datas = Array.from({ length: 10 }, (_, idx) => idx);
        const promises = datas.map((data) => pool.submit(data));

        await pool.terminate();

        await expect(Promise.allSettled(promises)).resolves.toEqual(
            Array.from({ length: datas.length }, () => ({
                status: "rejected",
                reason: new Error("WorkerPool terminated"),
            })),
        );
    });

    it("should fail on execute after destroy", async () => {
        const pool = new WorkerPool("0", script, { eval: true });

        await pool.terminate();

        await expect(pool.submit(0)).rejects.toThrow("WorkerPool terminated");
    });
});
