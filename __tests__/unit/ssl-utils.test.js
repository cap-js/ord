const { decodeBase64, tokenizeDn, dnTokensMatch } = require("../../lib/auth/ssl-utils");

describe("SSL Utils", () => {
    describe("decodeBase64", () => {
        it("decodes padded and unpadded base64 values", () => {
            expect(decodeBase64("Y2VydGlmaWNhdGU=")).toBe("certificate");
            expect(decodeBase64("Y2VydGlmaWNhdGU")).toBe("certificate");
        });

        it.each(["not-valid-base64!!!", "abc=def", "====", "", null])("rejects malformed base64: %p", (value) => {
            expect(() => decodeBase64(value)).toThrow("Invalid base64 value");
        });
    });

    describe("tokenizeDn", () => {
        it("should split DN by comma and trim whitespace", () => {
            const dn = "CN=test, O=SAP SE, C=DE";
            const result = tokenizeDn(dn);
            expect(result).toEqual(["CN=test", "O=SAP SE", "C=DE"]);
        });

        it("should handle DN without spaces", () => {
            const dn = "CN=test,O=SAP,C=DE";
            const result = tokenizeDn(dn);
            expect(result).toEqual(["CN=test", "O=SAP", "C=DE"]);
        });

        it("should handle DN with varying whitespace", () => {
            const dn = "CN=test,  O=SAP SE  ,   C=DE";
            const result = tokenizeDn(dn);
            expect(result).toEqual(["CN=test", "O=SAP SE", "C=DE"]);
        });

        it("should filter out empty tokens", () => {
            const dn = "CN=test, , O=SAP SE, , C=DE";
            const result = tokenizeDn(dn);
            expect(result).toEqual(["CN=test", "O=SAP SE", "C=DE"]);
        });

        it("should handle single token", () => {
            const dn = "CN=test";
            const result = tokenizeDn(dn);
            expect(result).toEqual(["CN=test"]);
        });

        it("should handle empty string", () => {
            const dn = "";
            const result = tokenizeDn(dn);
            expect(result).toEqual([]);
        });

        // Slash-separated DN format (UCL)
        it("should split slash-separated DN (UCL format)", () => {
            const dn = "/CN=test/O=SAP SE/C=DE";
            const result = tokenizeDn(dn);
            expect(result).toEqual(["CN=test", "O=SAP SE", "C=DE"]);
        });

        it("should handle slash-separated DN without spaces", () => {
            const dn = "/CN=test/O=SAP/C=DE";
            const result = tokenizeDn(dn);
            expect(result).toEqual(["CN=test", "O=SAP", "C=DE"]);
        });

        it("should handle slash-separated DN with varying whitespace", () => {
            const dn = "/CN=test/  O=SAP SE  /   C=DE";
            const result = tokenizeDn(dn);
            expect(result).toEqual(["CN=test", "O=SAP SE", "C=DE"]);
        });

        it("should handle slash-separated single token", () => {
            const dn = "/CN=test";
            const result = tokenizeDn(dn);
            expect(result).toEqual(["CN=test"]);
        });

        it("should handle slash without leading slash as comma-separated", () => {
            const dn = "CN=test/O=SAP SE/C=DE";
            const result = tokenizeDn(dn);
            // Without leading slash, treated as comma-separated (won't split by slash)
            expect(result).toEqual(["CN=test/O=SAP SE/C=DE"]);
        });
    });

    describe("dnTokensMatch", () => {
        it("should return true for identical token arrays", () => {
            const tokens1 = ["CN=test", "O=SAP SE", "C=DE"];
            const tokens2 = ["CN=test", "O=SAP SE", "C=DE"];
            expect(dnTokensMatch(tokens1, tokens2)).toBe(true);
        });

        it("should return true for tokens in different order", () => {
            const tokens1 = ["CN=test", "O=SAP SE", "C=DE"];
            const tokens2 = ["C=DE", "O=SAP SE", "CN=test"];
            expect(dnTokensMatch(tokens1, tokens2)).toBe(true);
        });

        it("should return true for repeated DN attributes in different order", () => {
            const tokens1 = ["CN=test", "OU=Engineering", "OU=Engineering", "C=DE"];
            const tokens2 = ["OU=Engineering", "C=DE", "CN=test", "OU=Engineering"];

            expect(dnTokensMatch(tokens1, tokens2)).toBe(true);
        });

        it("should return false when repeated DN attribute counts differ", () => {
            const tokens1 = ["CN=test", "OU=Engineering", "OU=Engineering"];
            const tokens2 = ["CN=test", "OU=Engineering", "OU=Security"];

            expect(dnTokensMatch(tokens1, tokens2)).toBe(false);
        });

        it("should return false for different token values", () => {
            const tokens1 = ["CN=test", "O=SAP SE", "C=DE"];
            const tokens2 = ["CN=other", "O=SAP SE", "C=DE"];
            expect(dnTokensMatch(tokens1, tokens2)).toBe(false);
        });

        it("should return false for different number of tokens", () => {
            const tokens1 = ["CN=test", "O=SAP SE", "C=DE"];
            const tokens2 = ["CN=test", "O=SAP SE"];
            expect(dnTokensMatch(tokens1, tokens2)).toBe(false);
        });

        it("should return false for additional tokens", () => {
            const tokens1 = ["CN=test", "O=SAP SE", "C=DE"];
            const tokens2 = ["CN=test", "O=SAP SE", "C=DE", "L=Walldorf"];
            expect(dnTokensMatch(tokens1, tokens2)).toBe(false);
        });

        it("should return true for empty arrays", () => {
            const tokens1 = [];
            const tokens2 = [];
            expect(dnTokensMatch(tokens1, tokens2)).toBe(true);
        });
    });
});
