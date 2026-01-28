const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const TEST_APP_ROOT = path.join(__dirname, "integration-test-app");
const GEN_DIR = path.join(TEST_APP_ROOT, "gen");
const ORD_GEN_DIR = path.join(GEN_DIR, "srv");
const ORD_DOC_PATH = path.join(ORD_GEN_DIR, "ord-document.json");

/**
 * Execute cds build command and return result
 */
function runCdsBuild(cwd) {
    return new Promise((resolve) => {
        const buildProcess = spawn("npx", ["cds", "build", "--for", "ord"], {
            cwd,
            env: { ...process.env },
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        buildProcess.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        buildProcess.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        buildProcess.on("close", (code) => {
            resolve({ code, stdout, stderr });
        });
    });
}

/**
 * Clean up generated files
 */
function cleanupDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

describe("ORD Build Integration Tests", () => {
    describe("Successful Build", () => {
        let buildResult;
        let ordDocument;

        beforeAll(async () => {
            cleanupDir(GEN_DIR);
            buildResult = await runCdsBuild(TEST_APP_ROOT);
            if (fs.existsSync(ORD_DOC_PATH)) {
                ordDocument = JSON.parse(fs.readFileSync(ORD_DOC_PATH, "utf-8"));
            }
        }, 60000);

        afterAll(() => {
            cleanupDir(GEN_DIR);
        });

        test("should exit with code 0", () => {
            expect(buildResult.code).toBe(0);
        });

        test("should generate ord-document.json", () => {
            expect(fs.existsSync(ORD_DOC_PATH)).toBe(true);
            expect(fs.statSync(ORD_DOC_PATH).size).toBeGreaterThan(0);
        });

        test("should have correct ORD document structure", () => {
            expect(ordDocument).toHaveProperty("openResourceDiscovery");
            expect(ordDocument).toHaveProperty("apiResources");
            expect(ordDocument).toHaveProperty("eventResources");
            expect(ordDocument).toHaveProperty("packages");
        });

        test("should generate API resource definition files with non-zero size", () => {
            expect(ordDocument.apiResources.length).toBeGreaterThan(0);

            for (const apiResource of ordDocument.apiResources) {
                expect(apiResource.resourceDefinitions).toBeDefined();
                expect(apiResource.resourceDefinitions.length).toBeGreaterThan(0);

                for (const resDef of apiResource.resourceDefinitions) {
                    const filePath = path.join(ORD_GEN_DIR, resDef.url);
                    expect(fs.existsSync(filePath)).toBe(true);
                    expect(fs.statSync(filePath).size).toBeGreaterThan(0);
                }
            }
        });

        test("should generate Event resource definition files with non-zero size", () => {
            expect(ordDocument.eventResources.length).toBeGreaterThan(0);

            for (const eventResource of ordDocument.eventResources) {
                expect(eventResource.resourceDefinitions).toBeDefined();
                expect(eventResource.resourceDefinitions.length).toBeGreaterThan(0);

                for (const resDef of eventResource.resourceDefinitions) {
                    const filePath = path.join(ORD_GEN_DIR, resDef.url);
                    expect(fs.existsSync(filePath)).toBe(true);
                    expect(fs.statSync(filePath).size).toBeGreaterThan(0);
                }
            }
        });

        test("should include @OpenAPI.servers annotation in OpenAPI document", () => {
            const testServiceApi = ordDocument.apiResources.find((api) => api.ordId.includes("TestService"));
            expect(testServiceApi).toBeDefined();

            const openApiDef = testServiceApi.resourceDefinitions.find((def) => def.url.endsWith(".oas3.json"));
            expect(openApiDef).toBeDefined();

            const openApiPath = path.join(ORD_GEN_DIR, openApiDef.url);
            const openApiContent = JSON.parse(fs.readFileSync(openApiPath, "utf-8"));

            expect(openApiContent.servers).toBeDefined();
            expect(openApiContent.servers).toHaveLength(2);
            expect(openApiContent.servers[0].url).toBe("https://test-service.api.example.com");
            expect(openApiContent.servers[1].url).toBe("https://test-service-sandbox.api.example.com");
        });
    });

    describe("Failed Build", () => {
        let buildResult;
        let tempDir;

        beforeAll(async () => {
            // Create a temporary empty directory to trigger build failure
            // (no CDS project, no ORD plugin configured)
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ord-build-test-"));
            buildResult = await runCdsBuild(tempDir);
        }, 60000);

        afterAll(() => {
            // Clean up temporary directory
            if (tempDir && fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        });

        test("should exit with non-zero code", () => {
            expect(buildResult.code).not.toBe(0);
        });

        test("should output error message", () => {
            const output = buildResult.stdout + buildResult.stderr;
            expect(output.toLowerCase()).toMatch(/error/i);
        });
    });
});
