const { spawn } = require("child_process");
const path = require("path");

const APP = path.join(__dirname, "__tests__/integration/integration-test-app");
const L = (s) => console.log("REPRO| " + s);

function boot(config, port) {
    const child = spawn("npx", ["cds", "serve", "--port", String(port)], {
        cwd: APP,
        env: { ...process.env, CDS_CONFIG: config },
        stdio: ["ignore", "ignore", "ignore"],
    });
    return child;
}

async function waitUp(port, tries = 60) {
    for (let i = 0; i < tries; i++) {
        try {
            const r = await fetch(`http://localhost:${port}/ord/v1/documents/ord-document`);
            if (r.status === 200) return true;
        } catch {
            /* not up yet */
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`server on :${port} did not come up`);
}

(async () => {
    // Two real, independent app instances behind an imaginary load balancer.
    // Instance A's model includes PremiumService; instance B's does NOT.
    // (Represents two load-balanced instances whose per-process getCsn caches /
    //  composed models have diverged - e.g. rolling deploy, or one instance's LRU
    //  holds a toggled/extended model the other never composed.)
    const A_PORT = 41001;
    const B_PORT = 41002;
    const a = boot(".cdsrc.repro-a.json", A_PORT);
    const b = boot(".cdsrc.repro-b.json", B_PORT);

    try {
        await Promise.all([waitUp(A_PORT), waitUp(B_PORT)]);
        L("instance A (has PremiumService) up on :" + A_PORT);
        L("instance B (no PremiumService)  up on :" + B_PORT);

        // 1) LB routes the DOCUMENT request to instance A.
        const doc = await (await fetch(`http://localhost:${A_PORT}/ord/v1/documents/ord-document`)).json();
        const premiumEdmx = (doc.apiResources || [])
            .flatMap((ar) => ar.resourceDefinitions || [])
            .map((rd) => rd.url)
            .find((u) => /PremiumService\.edmx$/.test(u));
        L("");
        L("[A] GET /ord/v1/documents/ord-document  -> 200; document advertises:");
        L("        " + premiumEdmx);

        // 2) API Hub fetches that exact link; LB routes it to instance B.
        const onB = await fetch(`http://localhost:${B_PORT}${premiumEdmx}`);
        const onBText = (await onB.text()).trim();
        // sanity: the same link on instance A works fine
        const onA = await fetch(`http://localhost:${A_PORT}${premiumEdmx}`);

        L("");
        L("[A] GET " + premiumEdmx + "  -> HTTP " + onA.status + "  (would-be OK)");
        L("[B] GET " + premiumEdmx + "  -> HTTP " + onB.status);
        L("        response: " + onBText);
        L("");
        L("Same URL from the document: 200 on the instance that has the service,");
        L('500 on the one that does not => API Hub sees "does not contain EDMX File".');
    } finally {
        a.kill("SIGKILL");
        b.kill("SIGKILL");
    }
    process.exit(0);
})().catch((e) => {
    console.error("ERR", e);
    process.exit(1);
});
