const cds = require("@sap/cds");
const path = require("path");

(async () => {
    try {
        const projectRoot = path.join(__dirname, "integration-test-app");
        console.log("Starting ORD Integration Test Server from workspace root...");
        console.log("Using CDS project root:", projectRoot);

        cds.root = projectRoot;

        cds.env = undefined;
        cds.env = cds.env_for(projectRoot);

        const model = await cds.load("*");

        // 4) 正式启动服务（这次会包含 auth / ord / requires 等 config）
        await cds
            .serve("all")
            .from(model)
            .in(process.cwd()); // runtime 依然来自 workspace 根

        console.log("ORD Integration Test Server started.");
        console.log("Active services:", Object.keys(cds.services));

        // 服务器会持续运行，Jest 会管理进程生命周期
    } catch (err) {
        console.error("Failed to start ORD integration test server:", err);
        process.exit(1);
    }
})();
