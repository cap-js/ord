import fs from "fs";
import path from "path";

// Import the package's ESM entry to test ESM consumer behavior
// Import from package ESM entry so tests validate the published import path
import { ord } from "../../lib/index.mjs";

const fixtures = [
    path.resolve("__tests__/__mocks__/csnWithOneEvent.json"),
    path.resolve("__tests__/__mocks__/internalResourcesCsn.json"),
    path.resolve("__tests__/__mocks__/noApisCsn.json"),
];

let failures = 0;

for (const csnPath of fixtures) {
    if (!fs.existsSync(csnPath)) {
        console.warn("Skipping missing fixture", csnPath);
        continue;
    }
    const csn = JSON.parse(fs.readFileSync(csnPath, "utf8"));
    try {
        const result = ord(csn);
        if (!result || typeof result !== "object") {
            console.error(csnPath, "-> ord did not return an object");
            failures++;
        } else {
            console.log(csnPath, "-> ok, keys:", Object.keys(result).join(","));
        }
    } catch (e) {
        console.error(csnPath, "-> threw:", e && e.message ? e.message : e);
        failures++;
    }
}

if (failures > 0) {
    console.error("ESM compatibility test failed with", failures, "failures");
    process.exit(2);
}

console.log("All ESM compatibility tests passed");
process.exit(0);
