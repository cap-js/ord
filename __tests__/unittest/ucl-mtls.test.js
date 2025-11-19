const {
    extractSubjectFromHeader,
    normalizeSubject,
    subjectsEqual,
    createUclMtlsValidator,
} = require("../../lib/ucl-mtls");

describe("UCL mTLS Subject Validation", () => {
    describe("extractSubjectFromHeader", () => {
        it("should extract subject from XFCC-style header with quotes", () => {
            const header = 'Hash=abc123,Subject="CN=test, O=SAP SE, C=DE",URI=spiffe://example.com';
            const result = extractSubjectFromHeader(header);
            expect(result).toBe("CN=test, O=SAP SE, C=DE");
        });

        it("should extract subject from XFCC-style header without quotes", () => {
            const header = "Hash=abc123,Subject=CN=test, O=SAP SE, C=DE,URI=spiffe://example.com";
            const result = extractSubjectFromHeader(header);
            expect(result).toBe("CN=test, O=SAP SE, C=DE");
        });

        it("should handle raw DN as fallback", () => {
            const header = "CN=test, O=SAP SE, L=Walldorf, C=DE";
            const result = extractSubjectFromHeader(header);
            expect(result).toBe("CN=test, O=SAP SE, L=Walldorf, C=DE");
        });

        it("should return null for null input", () => {
            expect(extractSubjectFromHeader(null)).toBeNull();
            expect(extractSubjectFromHeader(undefined)).toBeNull();
        });

        it("should return null for empty string", () => {
            expect(extractSubjectFromHeader("")).toBeNull();
            expect(extractSubjectFromHeader("   ")).toBeNull();
        });

        it("should handle array input and use first element", () => {
            const headers = ["CN=test, O=SAP SE, C=DE", "CN=other, O=SAP, C=US"];
            const result = extractSubjectFromHeader(headers);
            expect(result).toBe("CN=test, O=SAP SE, C=DE");
        });

        it("should handle case-insensitive Subject key", () => {
            const header = 'Hash=abc,subject="CN=test, O=SAP SE, C=DE"';
            const result = extractSubjectFromHeader(header);
            expect(result).toBe("CN=test, O=SAP SE, C=DE");
        });

        it("should trim whitespace from extracted subject", () => {
            const header = 'Subject="  CN=test, O=SAP SE, C=DE  "';
            const result = extractSubjectFromHeader(header);
            expect(result).toBe("CN=test, O=SAP SE, C=DE");
        });
    });

    describe("normalizeSubject", () => {
        it("should split subject by comma and create a set", () => {
            const subject = "CN=test, O=SAP SE, C=DE";
            const result = normalizeSubject(subject);
            expect(result).toBeInstanceOf(Set);
            expect(result.size).toBe(3);
            expect(result.has("CN=test")).toBe(true);
            expect(result.has("O=SAP SE")).toBe(true);
            expect(result.has("C=DE")).toBe(true);
        });

        it("should trim whitespace from each token", () => {
            const subject = "CN=test  ,  O=SAP SE  ,  C=DE";
            const result = normalizeSubject(subject);
            expect(result.has("CN=test")).toBe(true);
            expect(result.has("O=SAP SE")).toBe(true);
            expect(result.has("C=DE")).toBe(true);
        });

        it("should filter out empty tokens", () => {
            const subject = "CN=test, , O=SAP SE, , C=DE";
            const result = normalizeSubject(subject);
            expect(result.size).toBe(3);
        });

        it("should handle subject with no spaces", () => {
            const subject = "CN=test,O=SAP,C=DE";
            const result = normalizeSubject(subject);
            expect(result.has("CN=test")).toBe(true);
            expect(result.has("O=SAP")).toBe(true);
            expect(result.has("C=DE")).toBe(true);
        });

        it("should handle subject with varying whitespace", () => {
            const subject = "CN=test,O=SAP SE  ,   C=DE";
            const result = normalizeSubject(subject);
            expect(result.has("CN=test")).toBe(true);
            expect(result.has("O=SAP SE")).toBe(true);
            expect(result.has("C=DE")).toBe(true);
        });
    });

    describe("subjectsEqual", () => {
        it("should return true for identical subjects", () => {
            const subject1 = "CN=test, O=SAP SE, C=DE";
            const subject2 = "CN=test, O=SAP SE, C=DE";
            expect(subjectsEqual(subject1, subject2)).toBe(true);
        });

        it("should return true for subjects with different ordering", () => {
            const subject1 = "CN=test, O=SAP SE, C=DE";
            const subject2 = "C=DE, O=SAP SE, CN=test";
            expect(subjectsEqual(subject1, subject2)).toBe(true);
        });

        it("should return true for subjects with different whitespace", () => {
            const subject1 = "CN=test,O=SAP SE,C=DE";
            const subject2 = "CN=test  ,  O=SAP SE  ,  C=DE";
            expect(subjectsEqual(subject1, subject2)).toBe(true);
        });

        it("should return false for subjects with different values", () => {
            const subject1 = "CN=test, O=SAP SE, C=DE";
            const subject2 = "CN=other, O=SAP SE, C=DE";
            expect(subjectsEqual(subject1, subject2)).toBe(false);
        });

        it("should return false for subjects with different number of tokens", () => {
            const subject1 = "CN=test, O=SAP SE, C=DE";
            const subject2 = "CN=test, O=SAP SE";
            expect(subjectsEqual(subject1, subject2)).toBe(false);
        });

        it("should return false for subjects with additional tokens", () => {
            const subject1 = "CN=test, O=SAP SE, C=DE";
            const subject2 = "CN=test, O=SAP SE, C=DE, L=Walldorf";
            expect(subjectsEqual(subject1, subject2)).toBe(false);
        });

        it("should handle subjects with different orderings and whitespace", () => {
            const subject1 = "CN=test,O=SAP SE,C=DE,L=Walldorf";
            const subject2 = "L=Walldorf  ,  C=DE  ,  CN=test  ,  O=SAP SE";
            expect(subjectsEqual(subject1, subject2)).toBe(true);
        });
    });

    describe("createUclMtlsValidator", () => {
        const mockExpectedSubjects = ["CN=aggregator, O=SAP SE, C=DE", "CN=backup, O=SAP SE, C=US"];

        it("should throw error if expectedSubjects is not an array", () => {
            expect(() => createUclMtlsValidator({ expectedSubjects: "not-an-array" })).toThrow(
                "expectedSubjects must be a non-empty array",
            );
        });

        it("should throw error if expectedSubjects is empty array", () => {
            expect(() => createUclMtlsValidator({ expectedSubjects: [] })).toThrow(
                "expectedSubjects must be a non-empty array",
            );
        });

        it("should throw error if expectedSubjects contains only empty values", () => {
            expect(() => createUclMtlsValidator({ expectedSubjects: ["", "  ", null] })).toThrow(
                "expectedSubjects contains only empty values",
            );
        });

        it("should return a validator function", () => {
            const validator = createUclMtlsValidator({ expectedSubjects: mockExpectedSubjects });
            expect(typeof validator).toBe("function");
        });

        it("should use default header name if not provided", () => {
            const validator = createUclMtlsValidator({ expectedSubjects: mockExpectedSubjects });
            const req = {
                headers: {
                    "x-forwarded-client-cert": "CN=aggregator, O=SAP SE, C=DE",
                },
            };
            const result = validator(req);
            expect(result.ok).toBe(true);
        });

        it("should use custom header name if provided", () => {
            const validator = createUclMtlsValidator({
                expectedSubjects: mockExpectedSubjects,
                headerName: "x-client-cert",
            });
            const req = {
                headers: {
                    "x-client-cert": "CN=aggregator, O=SAP SE, C=DE",
                },
            };
            const result = validator(req);
            expect(result.ok).toBe(true);
        });

        describe("validator function", () => {
            let validator;

            beforeEach(() => {
                validator = createUclMtlsValidator({ expectedSubjects: mockExpectedSubjects });
            });

            it("should return ok:true for matching subject", () => {
                const req = {
                    headers: {
                        "x-forwarded-client-cert": "CN=aggregator, O=SAP SE, C=DE",
                    },
                };
                const result = validator(req);
                expect(result).toEqual({
                    ok: true,
                    subject: "CN=aggregator, O=SAP SE, C=DE",
                });
            });

            it("should return ok:true for second matching subject", () => {
                const req = {
                    headers: {
                        "x-forwarded-client-cert": "CN=backup, O=SAP SE, C=US",
                    },
                };
                const result = validator(req);
                expect(result).toEqual({
                    ok: true,
                    subject: "CN=backup, O=SAP SE, C=US",
                });
            });

            it("should return ok:true for matching subject with different ordering", () => {
                const req = {
                    headers: {
                        "x-forwarded-client-cert": "C=DE, O=SAP SE, CN=aggregator",
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(true);
            });

            it("should return ok:false with HEADER_MISSING for missing header", () => {
                const req = {
                    headers: {},
                };
                const result = validator(req);
                expect(result).toEqual({
                    ok: false,
                    reason: "HEADER_MISSING",
                });
            });

            it("should return ok:false with NO_HEADERS for missing headers object", () => {
                const req = {};
                const result = validator(req);
                expect(result).toEqual({
                    ok: false,
                    reason: "NO_HEADERS",
                });
            });

            it("should return ok:false with SUBJECT_MISSING for empty header", () => {
                const req = {
                    headers: {
                        "x-forwarded-client-cert": "",
                    },
                };
                const result = validator(req);
                expect(result).toEqual({
                    ok: false,
                    reason: "SUBJECT_MISSING",
                });
            });

            it("should return ok:false with SUBJECT_MISMATCH for non-matching subject", () => {
                const req = {
                    headers: {
                        "x-forwarded-client-cert": "CN=intruder, O=Evil Corp, C=XX",
                    },
                };
                const result = validator(req);
                expect(result).toEqual({
                    ok: false,
                    reason: "SUBJECT_MISMATCH",
                    subject: "CN=intruder, O=Evil Corp, C=XX",
                });
            });

            it("should handle XFCC-style header format", () => {
                const req = {
                    headers: {
                        "x-forwarded-client-cert": 'Hash=abc,Subject="CN=aggregator, O=SAP SE, C=DE",URI=spiffe://test',
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(true);
            });

            it("should match subject regardless of whitespace differences", () => {
                const req = {
                    headers: {
                        "x-forwarded-client-cert": "CN=aggregator,O=SAP SE,C=DE",
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(true);
            });

            it("should be case-sensitive for header lookup", () => {
                const validator = createUclMtlsValidator({
                    expectedSubjects: mockExpectedSubjects,
                    headerName: "X-Client-Cert",
                });
                const req = {
                    headers: {
                        "x-client-cert": "CN=aggregator, O=SAP SE, C=DE",
                    },
                };
                const result = validator(req);
                expect(result.ok).toBe(true);
            });
        });
    });
});
