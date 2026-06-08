const { replace } = require("../../../lib/common/placeholders");

describe("placeholders.replace", () => {
    it("replaces a single placeholder", () => {
        expect(replace("{namespace}:package:myPkg:v1", { namespace: "customer.ns" })).toBe(
            "customer.ns:package:myPkg:v1"
        );
    });

    it("replaces multiple distinct placeholders", () => {
        expect(replace("{namespace}:apiResource:{type}:v1", { namespace: "my.ns", type: "apiResource" })).toBe(
            "my.ns:apiResource:apiResource:v1"
        );
    });

    it("replaces all occurrences when the same placeholder appears more than once", () => {
        expect(replace("{namespace}:{namespace}:pkg:v1", { namespace: "x.ns" })).toBe("x.ns:x.ns:pkg:v1");
    });

    it("leaves unrecognised placeholders untouched", () => {
        expect(replace("{namespace}:{unknown}:v1", { namespace: "x.ns" })).toBe("x.ns:{unknown}:v1");
    });

    it("returns the value unchanged when the context has no matching keys", () => {
        expect(replace("static:ordId:v1", { namespace: "x.ns" })).toBe("static:ordId:v1");
    });

    it("returns undefined when value is undefined", () => {
        expect(replace(undefined, { namespace: "x.ns" })).toBeUndefined();
    });

    it("returns undefined when value is null", () => {
        expect(replace(null, { namespace: "x.ns" })).toBeUndefined();
    });

    it("returns an empty string when value is an empty string", () => {
        expect(replace("", { namespace: "x.ns" })).toBe("");
    });

    it("returns the value unchanged when the context is empty", () => {
        expect(replace("{namespace}:pkg:v1", {})).toBe("{namespace}:pkg:v1");
    });
});