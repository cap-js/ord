const {
    isXfccProxyVerified,
    extractCertHeaders,
    tokenizeDn,
    dnTokensMatch,
    createCfMtlsValidator,
} = require("../../lib/auth/cf-mtls");

describe("CF mTLS Validation", () => {
    const mockHeaderNames = {
        issuer: "x-ssl-client-issuer-dn",
        subject: "x-ssl-client-subject-dn",
        rootCa: "x-ssl-client-root-ca-dn",
    };

    // Valid XFCC headers for testing
    const validXfccHeaders = {
        "x-forwarded-client-cert": "Hash=abc123;Subject=CN=test",
        "x-ssl-client": "1",
        "x-ssl-client-verify": "0",
    };

    describe("isXfccProxyVerified", () => {
        it("should return true when all XFCC headers are valid", () => {
            const req = {
                headers: validXfccHeaders,
            };
            expect(isXfccProxyVerified(req)).toBe(true);
        });

        it("should return false when x-forwarded-client-cert header is missing", () => {
            const req = {
                headers: {
                    "x-ssl-client": "1",
                    "x-ssl-client-verify": "0",
                },
            };
            expect(isXfccProxyVerified(req)).toBe(false);
        });

        it("should return false when x-ssl-client is not '1'", () => {
            const req = {
                headers: {
                    "x-forwarded-client-cert": "Hash=abc123;Subject=CN=test",
                    "x-ssl-client": "0",
                    "x-ssl-client-verify": "0",
                },
            };
            expect(isXfccProxyVerified(req)).toBe(false);
        });

        it("should return false when x-ssl-client-verify is not '0'", () => {
            const req = {
                headers: {
                    "x-forwarded-client-cert": "Hash=abc123;Subject=CN=test",
                    "x-ssl-client": "1",
                    "x-ssl-client-verify": "1",
                },
            };
            expect(isXfccProxyVerified(req)).toBe(false);
        });

        it("should return false when headers object is missing", () => {
            const req = {};
            expect(isXfccProxyVerified(req)).toBe(false);
        });

        it("should return false when req is null", () => {
            expect(isXfccProxyVerified(null)).toBe(false);
        });

        it("should handle array header values by taking first element", () => {
            const req = {
                headers: {
                    "x-forwarded-client-cert": "Hash=abc123;Subject=CN=test",
                    "x-ssl-client": ["1", "0"],
                    "x-ssl-client-verify": ["0", "1"],
                },
            };
            expect(isXfccProxyVerified(req)).toBe(true);
        });

        it("should return false when x-ssl-client array has wrong first value", () => {
            const req = {
                headers: {
                    "x-forwarded-client-cert": "Hash=abc123;Subject=CN=test",
                    "x-ssl-client": ["0", "1"],
                    "x-ssl-client-verify": "0",
                },
            };
            expect(isXfccProxyVerified(req)).toBe(false);
        });
    });

    describe("extractCertHeaders", () => {
        it("should extract and decode base64-encoded headers", () => {
            const issuerDn = "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE";
            const subjectDn = "CN=aggregator, O=SAP SE, C=DE";
            const rootCaDn = "CN=SAP Global Root CA, O=SAP SE, C=DE";

            const req = {
                headers: {
                    "x-ssl-client-issuer-dn": Buffer.from(issuerDn).toString("base64"),
                    "x-ssl-client-subject-dn": Buffer.from(subjectDn).toString("base64"),
                    "x-ssl-client-root-ca-dn": Buffer.from(rootCaDn).toString("base64"),
                },
            };

            const result = extractCertHeaders(req, mockHeaderNames);

            expect(result.issuer).toBe(issuerDn);
            expect(result.subject).toBe(subjectDn);
            expect(result.rootCaDn).toBe(rootCaDn);
            expect(result.error).toBeUndefined();
        });

        it("should return error for missing headers object", () => {
            const req = {};
            const result = extractCertHeaders(req, mockHeaderNames);
            expect(result.error).toBe("NO_HEADERS");
        });

        it("should return error for missing issuer header", () => {
            const req = {
                headers: {
                    "x-ssl-client-subject-dn": Buffer.from("CN=test").toString("base64"),
                    "x-ssl-client-root-ca-dn": Buffer.from("CN=root").toString("base64"),
                },
            };
            const result = extractCertHeaders(req, mockHeaderNames);
            expect(result.error).toBe("HEADER_MISSING");
            expect(result.missing).toBe(mockHeaderNames.issuer);
        });

        it("should return error for missing subject header", () => {
            const req = {
                headers: {
                    "x-ssl-client-issuer-dn": Buffer.from("CN=test").toString("base64"),
                    "x-ssl-client-root-ca-dn": Buffer.from("CN=root").toString("base64"),
                },
            };
            const result = extractCertHeaders(req, mockHeaderNames);
            expect(result.error).toBe("HEADER_MISSING");
            expect(result.missing).toBe(mockHeaderNames.subject);
        });

        it("should return error for missing root CA header", () => {
            const req = {
                headers: {
                    "x-ssl-client-issuer-dn": Buffer.from("CN=test").toString("base64"),
                    "x-ssl-client-subject-dn": Buffer.from("CN=test").toString("base64"),
                },
            };
            const result = extractCertHeaders(req, mockHeaderNames);
            expect(result.error).toBe("HEADER_MISSING");
            expect(result.missing).toBe(mockHeaderNames.rootCa);
        });

        it("should handle array header values by taking first element", () => {
            const issuerDn = "CN=test, O=SAP SE";
            const req = {
                headers: {
                    "x-ssl-client-issuer-dn": [
                        Buffer.from(issuerDn).toString("base64"),
                        Buffer.from("CN=other").toString("base64"),
                    ],
                    "x-ssl-client-subject-dn": Buffer.from("CN=subject").toString("base64"),
                    "x-ssl-client-root-ca-dn": Buffer.from("CN=root").toString("base64"),
                },
            };
            const result = extractCertHeaders(req, mockHeaderNames);
            expect(result.issuer).toBe(issuerDn);
        });

        // Note: We no longer validate base64 encoding with regex.
        // CF always sends base64-encoded strings, and Buffer.from() will handle any decoding errors.

        it("should handle case-insensitive header names", () => {
            const issuerDn = "CN=test, O=SAP SE";
            const req = {
                headers: {
                    // Node.js/Express automatically lowercases header keys
                    "x-ssl-client-issuer-dn": Buffer.from(issuerDn).toString("base64"),
                    "x-ssl-client-subject-dn": Buffer.from("CN=subject").toString("base64"),
                    "x-ssl-client-root-ca-dn": Buffer.from("CN=root").toString("base64"),
                },
            };
            // Even though we provide mixed-case header names in config, it should work
            // because the function lowercases them for lookup
            const result = extractCertHeaders(req, {
                issuer: "X-Ssl-Client-Issuer-DN",
                subject: "X-Ssl-Client-Subject-DN",
                rootCa: "X-Ssl-Client-Root-CA-DN",
            });
            expect(result.issuer).toBe(issuerDn);
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

    describe("createCfMtlsValidator", () => {
        const mockTrustedCertPairs = [
            {
                issuer: "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                subject: "CN=aggregator, O=SAP SE, C=DE",
            },
            {
                issuer: "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                subject: "CN=backup-service, O=SAP SE, C=US",
            },
        ];

        const mockTrustedRootCaDns = [
            "CN=SAP Global Root CA, O=SAP SE, C=DE",
            "CN=DigiCert Global Root CA, O=DigiCert Inc, C=US",
        ];

        it("should throw error if trustedCertPairs is not an array", () => {
            expect(() =>
                createCfMtlsValidator({
                    trustedCertPairs: "not-an-array",
                    trustedRootCaDns: mockTrustedRootCaDns,
                    headerNames: mockHeaderNames,
                }),
            ).toThrow("mTLS validation requires at least one trusted certificate (issuer/subject pair)");
        });

        it("should throw error if trustedCertPairs is empty", () => {
            expect(() =>
                createCfMtlsValidator({
                    trustedCertPairs: [],
                    trustedRootCaDns: mockTrustedRootCaDns,
                    headerNames: mockHeaderNames,
                }),
            ).toThrow("mTLS validation requires at least one trusted certificate (issuer/subject pair)");
        });

        it("should throw error if trustedRootCaDns is not an array", () => {
            expect(() =>
                createCfMtlsValidator({
                    trustedCertPairs: mockTrustedCertPairs,
                    trustedRootCaDns: "not-an-array",
                    headerNames: mockHeaderNames,
                }),
            ).toThrow("mTLS validation requires at least one trusted root CA DN");
        });

        it("should throw error if trustedRootCaDns is empty", () => {
            expect(() =>
                createCfMtlsValidator({
                    trustedCertPairs: mockTrustedCertPairs,
                    trustedRootCaDns: [],
                    headerNames: mockHeaderNames,
                }),
            ).toThrow("mTLS validation requires at least one trusted root CA DN");
        });

        it("should throw error if headerNames is missing", () => {
            expect(() =>
                createCfMtlsValidator({
                    trustedCertPairs: mockTrustedCertPairs,
                    trustedRootCaDns: mockTrustedRootCaDns,
                }),
            ).toThrow("headerNames must specify issuer, subject, and rootCa");
        });

        it("should return a validator function", () => {
            const validator = createCfMtlsValidator({
                trustedCertPairs: mockTrustedCertPairs,
                trustedRootCaDns: mockTrustedRootCaDns,
                headerNames: mockHeaderNames,
            });
            expect(typeof validator).toBe("function");
        });

        describe("validator function", () => {
            let validator;

            beforeEach(() => {
                validator = createCfMtlsValidator({
                    trustedCertPairs: mockTrustedCertPairs,
                    trustedRootCaDns: mockTrustedRootCaDns,
                    headerNames: mockHeaderNames,
                });
            });

            it("should return ok:true for matching certificate pair and root CA", () => {
                const req = {
                    headers: {
                        ...validXfccHeaders,
                        "x-ssl-client-issuer-dn": Buffer.from(
                            "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                        ).toString("base64"),
                        "x-ssl-client-subject-dn": Buffer.from("CN=aggregator, O=SAP SE, C=DE").toString("base64"),
                        "x-ssl-client-root-ca-dn": Buffer.from("CN=SAP Global Root CA, O=SAP SE, C=DE").toString(
                            "base64",
                        ),
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(true);
                expect(result.issuer).toBe("CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE");
                expect(result.subject).toBe("CN=aggregator, O=SAP SE, C=DE");
                expect(result.rootCaDn).toBe("CN=SAP Global Root CA, O=SAP SE, C=DE");
            });

            it("should return ok:true for second certificate pair", () => {
                const req = {
                    headers: {
                        ...validXfccHeaders,
                        "x-ssl-client-issuer-dn": Buffer.from(
                            "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                        ).toString("base64"),
                        "x-ssl-client-subject-dn": Buffer.from("CN=backup-service, O=SAP SE, C=US").toString("base64"),
                        "x-ssl-client-root-ca-dn": Buffer.from("CN=SAP Global Root CA, O=SAP SE, C=DE").toString(
                            "base64",
                        ),
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(true);
            });

            it("should return ok:true with different token ordering", () => {
                const req = {
                    headers: {
                        ...validXfccHeaders,
                        "x-ssl-client-issuer-dn": Buffer.from(
                            "C=DE, O=SAP SE, CN=SAP Cloud Platform Client CA",
                        ).toString("base64"),
                        "x-ssl-client-subject-dn": Buffer.from("C=DE, O=SAP SE, CN=aggregator").toString("base64"),
                        "x-ssl-client-root-ca-dn": Buffer.from("C=DE, O=SAP SE, CN=SAP Global Root CA").toString(
                            "base64",
                        ),
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(true);
            });

            it("should work with slash-separated DN format (UCL)", () => {
                const req = {
                    headers: {
                        ...validXfccHeaders,
                        "x-ssl-client-issuer-dn": Buffer.from(
                            "/C=DE/O=SAP SE/CN=SAP Cloud Platform Client CA",
                        ).toString("base64"),
                        "x-ssl-client-subject-dn": Buffer.from("/C=DE/O=SAP SE/CN=aggregator").toString("base64"),
                        "x-ssl-client-root-ca-dn": Buffer.from("/C=DE/O=SAP SE/CN=SAP Global Root CA").toString(
                            "base64",
                        ),
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(true);
                expect(result.issuer).toBe("/C=DE/O=SAP SE/CN=SAP Cloud Platform Client CA");
                expect(result.subject).toBe("/C=DE/O=SAP SE/CN=aggregator");
                expect(result.rootCaDn).toBe("/C=DE/O=SAP SE/CN=SAP Global Root CA");
            });

            it("should return ok:false with XFCC_VERIFICATION_FAILED when XFCC headers are missing", () => {
                const req = {
                    headers: {
                        "x-ssl-client-issuer-dn": Buffer.from(
                            "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                        ).toString("base64"),
                        "x-ssl-client-subject-dn": Buffer.from("CN=aggregator, O=SAP SE, C=DE").toString("base64"),
                        "x-ssl-client-root-ca-dn": Buffer.from("CN=SAP Global Root CA, O=SAP SE, C=DE").toString(
                            "base64",
                        ),
                        // Missing XFCC headers
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(false);
                expect(result.reason).toBe("XFCC_VERIFICATION_FAILED");
            });

            it("should return ok:false with XFCC_VERIFICATION_FAILED when XFCC verification fails", () => {
                const req = {
                    headers: {
                        ...validXfccHeaders,
                        "x-ssl-client": "0", // Invalid value
                        "x-ssl-client-issuer-dn": Buffer.from(
                            "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                        ).toString("base64"),
                        "x-ssl-client-subject-dn": Buffer.from("CN=aggregator, O=SAP SE, C=DE").toString("base64"),
                        "x-ssl-client-root-ca-dn": Buffer.from("CN=SAP Global Root CA, O=SAP SE, C=DE").toString(
                            "base64",
                        ),
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(false);
                expect(result.reason).toBe("XFCC_VERIFICATION_FAILED");
            });

            it("should return ok:true when both XFCC and certificate headers are valid", () => {
                const req = {
                    headers: {
                        ...validXfccHeaders,
                        "x-ssl-client-issuer-dn": Buffer.from(
                            "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                        ).toString("base64"),
                        "x-ssl-client-subject-dn": Buffer.from("CN=aggregator, O=SAP SE, C=DE").toString("base64"),
                        "x-ssl-client-root-ca-dn": Buffer.from("CN=SAP Global Root CA, O=SAP SE, C=DE").toString(
                            "base64",
                        ),
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(true);
            });

            it("should return ok:false with XFCC_VERIFICATION_FAILED for missing headers object", () => {
                const req = {};
                const result = validator(req);
                expect(result.ok).toBe(false);
                expect(result.reason).toBe("XFCC_VERIFICATION_FAILED");
            });

            it("should return ok:false with HEADER_MISSING for missing issuer header", () => {
                const req = {
                    headers: {
                        ...validXfccHeaders,
                        "x-ssl-client-subject-dn": Buffer.from("CN=test").toString("base64"),
                        "x-ssl-client-root-ca-dn": Buffer.from("CN=root").toString("base64"),
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(false);
                expect(result.reason).toBe("HEADER_MISSING");
            });

            it("should return ok:false with CERT_PAIR_MISMATCH for non-matching issuer", () => {
                const req = {
                    headers: {
                        ...validXfccHeaders,
                        "x-ssl-client-issuer-dn": Buffer.from("CN=Evil CA, O=Evil Corp, C=XX").toString(
                            "base64",
                        ),
                        "x-ssl-client-subject-dn": Buffer.from("CN=aggregator, O=SAP SE, C=DE").toString(
                            "base64",
                        ),
                        "x-ssl-client-root-ca-dn": Buffer.from(
                            "CN=SAP Global Root CA, O=SAP SE, C=DE",
                        ).toString("base64"),
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(false);
                expect(result.reason).toBe("CERT_PAIR_MISMATCH");
                expect(result.issuer).toBe("CN=Evil CA, O=Evil Corp, C=XX");
                expect(result.subject).toBe("CN=aggregator, O=SAP SE, C=DE");
            });

            it("should return ok:false with CERT_PAIR_MISMATCH for non-matching subject", () => {
                const req = {
                    headers: {
                        ...validXfccHeaders,
                        "x-ssl-client-issuer-dn": Buffer.from(
                            "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                        ).toString("base64"),
                        "x-ssl-client-subject-dn": Buffer.from("CN=intruder, O=Evil Corp, C=XX").toString(
                            "base64",
                        ),
                        "x-ssl-client-root-ca-dn": Buffer.from(
                            "CN=SAP Global Root CA, O=SAP SE, C=DE",
                        ).toString("base64"),
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(false);
                expect(result.reason).toBe("CERT_PAIR_MISMATCH");
            });

            it("should return ok:false with ROOT_CA_MISMATCH for non-matching root CA", () => {
                const req = {
                    headers: {
                        ...validXfccHeaders,
                        "x-ssl-client-issuer-dn": Buffer.from(
                            "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                        ).toString("base64"),
                        "x-ssl-client-subject-dn": Buffer.from("CN=aggregator, O=SAP SE, C=DE").toString(
                            "base64",
                        ),
                        "x-ssl-client-root-ca-dn": Buffer.from(
                            "CN=Evil Root CA, O=Evil Corp, C=XX",
                        ).toString("base64"),
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(false);
                expect(result.reason).toBe("ROOT_CA_MISMATCH");
                expect(result.rootCaDn).toBe("CN=Evil Root CA, O=Evil Corp, C=XX");
            });

            it("should require both issuer and subject to match as a pair", () => {
                // Valid issuer with wrong subject should fail
                const req1 = {
                    headers: {
                        ...validXfccHeaders,
                        "x-ssl-client-issuer-dn": Buffer.from(
                            "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                        ).toString("base64"),
                        "x-ssl-client-subject-dn":
                            Buffer.from("CN=unknown, O=SAP SE, C=DE").toString("base64"),
                        "x-ssl-client-root-ca-dn": Buffer.from(
                            "CN=SAP Global Root CA, O=SAP SE, C=DE",
                        ).toString("base64"),
                    },
                };
                expect(validator(req1).ok).toBe(false);

                // Valid subject with wrong issuer should fail
                const req2 = {
                    headers: {
                        ...validXfccHeaders,
                        "x-ssl-client-issuer-dn": Buffer.from("CN=Unknown CA, O=SAP SE, C=DE").toString(
                            "base64",
                        ),
                        "x-ssl-client-subject-dn": Buffer.from("CN=aggregator, O=SAP SE, C=DE").toString(
                            "base64",
                        ),
                        "x-ssl-client-root-ca-dn": Buffer.from(
                            "CN=SAP Global Root CA, O=SAP SE, C=DE",
                        ).toString("base64"),
                    },
                };
                expect(validator(req2).ok).toBe(false);
            });
        });
    });
});
