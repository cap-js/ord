const { slice } = require("../../lib/common/slice");

const ORD_META = {
    $schema: "https://sap.github.io/open-resource-discovery/spec-v1/interfaces/Document.schema.json",
    description: "Test ORD Document",
    perspective: "system-instance",
    policyLevel: "sap:core:v1",
    policyLevels: ["sap:core:v1"],
    customPolicyLevel: "sap:custom:v1",
    describedSystemType: "sap.testApp:System:v1",
    openResourceDiscovery: "1.9",
    describedSystemVersion: "1.0.0",
    describedSystemInstance: "instance-1",
};

function makeItems(n, payloadSize = 10) {
    return Array.from({ length: n }, (_, i) => ({ id: String(i).padStart(payloadSize, "x") }));
}

function docSize(doc) {
    return Buffer.byteLength(JSON.stringify(doc), "utf8");
}

describe("slice", () => {
    describe("document below limit", () => {
        it("returns the document as a single-element array when it is smaller than the limit", () => {
            const doc = { ...ORD_META, apis: makeItems(5) };
            const result = slice(doc, docSize(doc) + 1000);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(doc);
        });

        it("returns the document as a single-element array when it exactly equals the limit minus one byte", () => {
            const doc = { ...ORD_META, apis: makeItems(2) };
            const result = slice(doc, docSize(doc) + 1);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(doc);
        });
    });

    describe("document at or above limit", () => {
        it("splits into multiple slices when document exceeds the limit", () => {
            const doc = { ...ORD_META, apis: makeItems(200, 100) };
            const result = slice(doc, Math.floor(docSize(doc) / 3));

            expect(result.length).toBeGreaterThan(1);
        });

        it("produces more slices when the limit is tighter", () => {
            const doc = { ...ORD_META, apis: makeItems(400, 100) };
            const resultBig = slice(doc, Math.floor(docSize(doc) / 2));
            const resultSmall = slice(doc, Math.floor(docSize(doc) / 8));

            expect(resultSmall.length).toBeGreaterThan(resultBig.length);
        });

        it("preserves all ordMainPartKeys in every slice", () => {
            const doc = { ...ORD_META, apis: makeItems(200, 100) };
            const result = slice(doc, Math.floor(docSize(doc) / 3));

            for (const slice of result) {
                expect(slice).toMatchObject({
                    $schema: doc.$schema,
                    description: doc.description,
                    perspective: doc.perspective,
                    policyLevel: doc.policyLevel,
                    policyLevels: doc.policyLevels,
                    customPolicyLevel: doc.customPolicyLevel,
                    describedSystemType: doc.describedSystemType,
                    openResourceDiscovery: doc.openResourceDiscovery,
                    describedSystemVersion: doc.describedSystemVersion,
                    describedSystemInstance: doc.describedSystemInstance,
                });
            }
        });

        it("reassembling slices recovers the original array items", () => {
            const doc = { ...ORD_META, apis: makeItems(200, 100) };
            const result = slice(doc, Math.floor(docSize(doc) / 3));

            expect(result.flatMap((s) => s.apis ?? [])).toEqual(doc.apis);
        });

        it("does not lose items across slice boundaries", () => {
            const doc = { ...ORD_META, packages: makeItems(300, 50) };
            const result = slice(doc, Math.floor(docSize(doc) / 4));

            expect(result.reduce((sum, s) => sum + (s.packages?.length ?? 0), 0)).toBe(doc.packages.length);
        });
    });

    describe("multiple resource arrays", () => {
        it("distributes multiple arrays across slices preserving all items", () => {
            const doc = { ...ORD_META, apis: makeItems(100, 80), events: makeItems(100, 80) };
            const result = slice(doc, Math.floor(docSize(doc) / 4));

            expect(result.length).toBeGreaterThan(1);
            expect(result.flatMap((s) => s.apis ?? [])).toEqual(doc.apis);
            expect(result.flatMap((s) => s.events ?? [])).toEqual(doc.events);
        });
    });

    describe("edge cases", () => {
        it("handles a document with no resource arrays (only metadata)", () => {
            const doc = { ...ORD_META };
            const result = slice(doc, 1); // force the split path

            // metadata-only: one final slice with just ord meta
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject(ORD_META);
        });

        it("handles a single very large item that alone approaches the limit", () => {
            const bigItem = { id: "x".repeat(500) };
            const doc = { ...ORD_META, apis: [bigItem] };
            const result = slice(doc, docSize(doc) - 1); // force split

            expect(result.flatMap((s) => s.apis ?? [])).toEqual([bigItem]);
        });

        it("uses chunk size to batch items and still preserves all data", () => {
            const doc = { ...ORD_META, apis: makeItems(50, 200) };
            const result = slice(doc, Math.floor(docSize(doc) / 2), 10); // pass chunk=10 explicitly

            expect(result.flatMap((s) => s.apis ?? [])).toEqual(doc.apis);
        });

        it("returns array with the document unchanged when limit is very large", () => {
            const doc = { ...ORD_META, apis: makeItems(10) };
            const result = slice(doc, Number.MAX_SAFE_INTEGER);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(doc);
        });

        it("handles a document that contains only ordMainPartKeys (no extra arrays)", () => {
            const doc = {
                $schema: "https://example.com/schema",
                openResourceDiscovery: "1.9",
            };
            const result = slice(doc, 1); // force split path

            expect(result).toHaveLength(1);
            expect(result[0].$schema).toBe(doc.$schema);
            expect(result[0].openResourceDiscovery).toBe(doc.openResourceDiscovery);
        });

        it("only includes ordMainPartKeys that are present in the source document", () => {
            const doc = {
                $schema: "https://example.com/schema",
                openResourceDiscovery: "1.9",
                apis: makeItems(100, 100),
            };
            const result = slice(doc, Math.floor(docSize(doc) / 2));

            for (const slice of result) {
                expect(slice).not.toHaveProperty("description");
                expect(slice).not.toHaveProperty("policyLevel");
            }
        });
    });
});
