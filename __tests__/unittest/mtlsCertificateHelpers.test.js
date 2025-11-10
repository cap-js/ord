const {
    tokenizeDn,
    dnTokensMatch,
    parseDnString,
    extractCertificateFromHeader,
    formatPemCertificate,
    isBase64,
    isBase64Encoded,
    isExpiredCertificate,
    getCertificateValidityWindow,
} = require("../../lib/middleware/certificateHelpers");

describe("Certificate Helpers", () => {
    describe("tokenizeDn", () => {
        it("should tokenize DN with comma separators", () => {
            const dn = "CN=Test User,O=Test Org,C=US";
            const tokens = tokenizeDn(dn);
            expect(tokens).toEqual(["CN=Test User", "O=Test Org", "C=US"]);
        });

        it("should tokenize DN with slash separators", () => {
            const dn = "/CN=Test User/O=Test Org/C=US";
            const tokens = tokenizeDn(dn);
            expect(tokens).toEqual(["CN=Test User", "O=Test Org", "C=US"]);
        });

        it("should handle mixed separators", () => {
            const dn = "/CN=Test User,O=Test Org/C=US";
            const tokens = tokenizeDn(dn);
            expect(tokens).toEqual(["CN=Test User", "O=Test Org", "C=US"]);
        });

        it("should return empty array for invalid input", () => {
            expect(tokenizeDn(null)).toEqual([]);
            expect(tokenizeDn(undefined)).toEqual([]);
            expect(tokenizeDn("")).toEqual([]);
            expect(tokenizeDn(123)).toEqual([]);
        });

        it("should handle DN with spaces", () => {
            const dn = "CN=Test User , O=Test Org , C=US";
            const tokens = tokenizeDn(dn);
            expect(tokens).toEqual(["CN=Test User", "O=Test Org", "C=US"]);
        });
    });

    describe("dnTokensMatch", () => {
        it("should match identical token sets", () => {
            const tokens1 = ["CN=Test", "O=Org", "C=US"];
            const tokens2 = ["CN=Test", "O=Org", "C=US"];
            expect(dnTokensMatch(tokens1, tokens2)).toBe(true);
        });

        it("should match token sets in different order", () => {
            const tokens1 = ["CN=Test", "O=Org", "C=US"];
            const tokens2 = ["C=US", "CN=Test", "O=Org"];
            expect(dnTokensMatch(tokens1, tokens2)).toBe(true);
        });

        it("should not match different token sets", () => {
            const tokens1 = ["CN=Test", "O=Org", "C=US"];
            const tokens2 = ["CN=Different", "O=Org", "C=US"];
            expect(dnTokensMatch(tokens1, tokens2)).toBe(false);
        });

        it("should not match token sets of different lengths", () => {
            const tokens1 = ["CN=Test", "O=Org"];
            const tokens2 = ["CN=Test", "O=Org", "C=US"];
            expect(dnTokensMatch(tokens1, tokens2)).toBe(false);
        });

        it("should handle invalid inputs", () => {
            expect(dnTokensMatch(null, ["CN=Test"])).toBe(false);
            expect(dnTokensMatch(["CN=Test"], null)).toBe(false);
            expect(dnTokensMatch("not array", ["CN=Test"])).toBe(false);
        });
    });

    describe("parseDnString", () => {
        it("should parse standard DN string", () => {
            const dn = "CN=Test User,O=Test Org,OU=Test Unit,C=US,L=City,ST=State";
            const parsed = parseDnString(dn);
            expect(parsed).toEqual({
                DN: dn,
                CN: "Test User",
                O: "Test Org",
                OU: "Test Unit",
                C: "US",
                L: "City",
                ST: "State",
            });
        });

        it("should handle DN with equals signs in values", () => {
            const dn = "CN=Test=User,O=Test Org";
            const parsed = parseDnString(dn);
            expect(parsed).toEqual({
                DN: dn,
                CN: "Test=User",
                O: "Test Org",
            });
        });

        it("should handle empty DN", () => {
            const parsed = parseDnString("");
            expect(parsed).toEqual({ DN: "" });
        });

        it("should handle null/undefined DN", () => {
            expect(parseDnString(null)).toEqual({ DN: null });
            expect(parseDnString(undefined)).toEqual({ DN: undefined });
        });
    });

    describe("formatPemCertificate", () => {
        it("should format certificate without headers", () => {
            const cert = "MIIBkTCB+wIJANR0Z5gZl5l5MA0GCSqGSIb3DQEBCwUA";
            const formatted = formatPemCertificate(cert);
            expect(formatted).toContain("-----BEGIN CERTIFICATE-----");
            expect(formatted).toContain("-----END CERTIFICATE-----");
            expect(formatted).toContain(cert);
        });

        it("should leave properly formatted certificate unchanged", () => {
            const cert = "-----BEGIN CERTIFICATE-----\nMIIBkTCB+wIJANR0Z5gZl5l5MA0GCSqGSIb3DQEBCwUA\n-----END CERTIFICATE-----";
            const formatted = formatPemCertificate(cert);
            expect(formatted).toContain("-----BEGIN CERTIFICATE-----");
            expect(formatted).toContain("-----END CERTIFICATE-----");
        });

        it("should handle empty input", () => {
            expect(formatPemCertificate("")).toBe("");
            expect(formatPemCertificate(null)).toBe(null);
            expect(formatPemCertificate(undefined)).toBe(undefined);
        });
    });

    describe("isBase64", () => {
        it("should identify valid base64 strings", () => {
            expect(isBase64("SGVsbG8gV29ybGQ=")).toBe(true);
            expect(isBase64("dGVzdA==")).toBe(true);
            expect(isBase64("dGVzdA")).toBe(true);
        });

        it("should reject invalid base64 strings", () => {
            expect(isBase64("Hello World!")).toBe(false);
            expect(isBase64("test@#$")).toBe(false);
            expect(isBase64("test===")).toBe(false); // too many padding chars
        });

        it("should handle edge cases", () => {
            expect(isBase64("")).toBe(true); // empty string is valid base64
            expect(isBase64(null)).toBe(false);
            expect(isBase64(undefined)).toBe(false);
            expect(isBase64(123)).toBe(false);
        });
    });

    describe("isBase64Encoded", () => {
        it("should identify valid base64 encoded strings", () => {
            expect(isBase64Encoded("SGVsbG8gV29ybGQ=")).toBe(true);
            expect(isBase64Encoded("dGVzdA==")).toBe(true);
            expect(isBase64Encoded("dGVzdA")).toBe(true);
        });

        it("should reject invalid strings", () => {
            expect(isBase64Encoded("Hello World!")).toBe(false);
            expect(isBase64Encoded("test@#$")).toBe(false);
            expect(isBase64Encoded("")).toBe(false); // empty string is not considered encoded
            expect(isBase64Encoded(null)).toBe(false);
            expect(isBase64Encoded(undefined)).toBe(false);
        });
    });

    describe("extractCertificateFromHeader", () => {
        it("should extract certificate from x-forwarded-client-cert format", () => {
            const headerValue = 'Cert="-----BEGIN%20CERTIFICATE-----%0AMIIBkTCB%2BwIJANR0Z5gZl5l5MA0GCSqGSIb3DQEBCwUA%0A-----END%20CERTIFICATE-----"';
            const result = extractCertificateFromHeader(headerValue);
            expect(result).toContain("-----BEGIN CERTIFICATE-----");
            expect(result).toContain("-----END CERTIFICATE-----");
        });

        it("should handle base64 encoded certificate", () => {
            const cert = "MIIBkTCB+wIJANR0Z5gZl5l5MA0GCSqGSIb3DQEBCwUA";
            const base64Cert = Buffer.from(`-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`).toString("base64");
            const result = extractCertificateFromHeader(base64Cert);
            expect(result).toContain("-----BEGIN CERTIFICATE-----");
        });

        it("should return null for invalid input", () => {
            expect(extractCertificateFromHeader("")).toBe(null);
            expect(extractCertificateFromHeader(null)).toBe(null);
            expect(extractCertificateFromHeader("invalid")).toBe(null);
        });
    });

    describe("isExpiredCertificate", () => {
        it("should identify expired certificate", () => {
            const expiredCert = {
                validFrom: new Date("2020-01-01"),
                validTo: new Date("2021-01-01"),
            };
            expect(isExpiredCertificate(expiredCert)).toBe(true);
        });

        it("should identify valid certificate", () => {
            const validCert = {
                validFrom: new Date("2020-01-01"),
                validTo: new Date("2030-01-01"),
            };
            expect(isExpiredCertificate(validCert)).toBe(false);
        });

        it("should identify not-yet-valid certificate", () => {
            const futureValidCert = {
                validFrom: new Date("2030-01-01"),
                validTo: new Date("2031-01-01"),
            };
            expect(isExpiredCertificate(futureValidCert)).toBe(true);
        });

        it("should handle invalid input", () => {
            expect(isExpiredCertificate(null)).toBe(true);
            expect(isExpiredCertificate({})).toBe(true);
            expect(isExpiredCertificate({ validFrom: new Date() })).toBe(true);
        });
    });

    describe("getCertificateValidityWindow", () => {
        it("should return validity info for valid certificate", () => {
            const validCert = {
                validFrom: new Date("2020-01-01"),
                validTo: new Date("2030-01-01"),
            };
            const result = getCertificateValidityWindow(validCert);
            expect(result.isValid).toBe(true);
            expect(result.validFrom).toEqual(validCert.validFrom);
            expect(result.validTo).toEqual(validCert.validTo);
            expect(typeof result.daysRemaining).toBe("number");
        });

        it("should return validity info for expired certificate", () => {
            const expiredCert = {
                validFrom: new Date("2020-01-01"),
                validTo: new Date("2021-01-01"),
            };
            const result = getCertificateValidityWindow(expiredCert);
            expect(result.isValid).toBe(false);
            expect(result.validFrom).toEqual(expiredCert.validFrom);
            expect(result.validTo).toEqual(expiredCert.validTo);
            expect(result.daysRemaining).toBeUndefined();
        });

        it("should handle invalid input", () => {
            const result = getCertificateValidityWindow(null);
            expect(result.isValid).toBe(false);
            expect(result.validFrom).toBe(null);
            expect(result.validTo).toBe(null);
        });
    });
});
