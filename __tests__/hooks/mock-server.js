const net = require("node:net");
const http = require("node:http");
const { promisify } = require("node:util");
const { beforeAll, afterAll } = require("@jest/globals");

/**
 * Check if a port is available for binding
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} - True if port is available
 */
async function isPortAvailable(port) {
    return new Promise((resolve) => {
        const tester = net
            .createServer()
            .once("error", () => resolve(false))
            .once("listening", () => tester.once("close", () => resolve(true)).close())
            .listen(port);
    });
}

module.exports = function (port, response) {
    const server = http.createServer((req, res) => {
        if (req.method === "GET" && req.url === "/v1/info") {
            console.log(`Mock /v1/info endpoint called on port ${port}`);
            const body = JSON.stringify(response);
            res.writeHead(200, {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(body),
            });
            res.end(body);
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    beforeAll(async function () {
        // Check port availability first
        if (!(await isPortAvailable(port))) {
            throw new Error(`Port ${port} is already in use. Cannot start mock config server.`);
        }

        await promisify((callback) => server.listen(port, callback))();
    });

    afterAll(async () => {
        await promisify((callback) => server.close(callback))();
    });

    return {
        schema: "http",
        host: "localhost",
        port: port,
    };
};
