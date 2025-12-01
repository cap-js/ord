const cds = require("@sap/cds");
const {
    getAccessStrategiesFromAuthConfig,
    ensureAccessStrategies,
    hasNonOpenStrategies,
    ensureNoOpenWhenNonOpenPresent,
    isValidAccessStrategies,
} = require("../../lib/access-strategies");
const { AUTHENTICATION_TYPE, ORD_ACCESS_STRATEGY } = require("../../lib/constants");

describe("access-strategies", () => {
    beforeEach(() => {
        // Reset CDS environment
        cds.env.ord = {};
    });

    describe("getAccessStrategiesFromAuthConfig", () => {
        it("should return open strategy for empty auth config", () => {
            const authConfig = { types: [] };
            const strategies = getAccessStrategiesFromAuthConfig(authConfig);

            expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
        });

        it("should return open strategy for undefined auth config", () => {
            const strategies = getAccessStrategiesFromAuthConfig(undefined);

            expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
        });

        it("should return open strategy for null auth config", () => {
            const strategies = getAccessStrategiesFromAuthConfig(null);

            expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
        });

        it("should map Basic auth type to basic-auth strategy", () => {
            const authConfig = { types: [AUTHENTICATION_TYPE.Basic] };
            const strategies = getAccessStrategiesFromAuthConfig(authConfig);

            expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Basic }]);
        });

        it("should map CF mTLS auth type to sap:cmp-mtls:v1 strategy", () => {
            const authConfig = { types: [AUTHENTICATION_TYPE.CfMtls] };
            const strategies = getAccessStrategiesFromAuthConfig(authConfig);

            expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.CfMtls }]);
        });

        it("should map Open auth type to open strategy", () => {
            const authConfig = { types: [AUTHENTICATION_TYPE.Open] };
            const strategies = getAccessStrategiesFromAuthConfig(authConfig);

            expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
        });

        it("should map multiple auth types correctly", () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic, AUTHENTICATION_TYPE.CfMtls],
            };
            const strategies = getAccessStrategiesFromAuthConfig(authConfig);

            expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Basic }, { type: ORD_ACCESS_STRATEGY.CfMtls }]);
        });

        it("should handle unknown auth types gracefully", () => {
            const authConfig = { types: ["unknown-type"] };
            const strategies = getAccessStrategiesFromAuthConfig(authConfig);

            // Should fallback to open since no valid types found
            expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
        });

        it("should filter out unknown types and keep valid ones", () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic, "unknown-type", AUTHENTICATION_TYPE.CfMtls],
            };
            const strategies = getAccessStrategiesFromAuthConfig(authConfig);

            expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Basic }, { type: ORD_ACCESS_STRATEGY.CfMtls }]);
        });

        it("should handle invalid authConfig.types gracefully", () => {
            const authConfig = { types: "not-an-array" };
            const strategies = getAccessStrategiesFromAuthConfig(authConfig);

            expect(strategies).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
        });
    });

    describe("hasNonOpenStrategies", () => {
        it("should return false for empty array", () => {
            expect(hasNonOpenStrategies([])).toBe(false);
        });

        it("should return false for undefined", () => {
            expect(hasNonOpenStrategies(undefined)).toBe(false);
        });

        it("should return false for only open strategy", () => {
            const strategies = [{ type: ORD_ACCESS_STRATEGY.Open }];
            expect(hasNonOpenStrategies(strategies)).toBe(false);
        });

        it("should return true for basic strategy", () => {
            const strategies = [{ type: ORD_ACCESS_STRATEGY.Basic }];
            expect(hasNonOpenStrategies(strategies)).toBe(true);
        });

        it("should return true for CF mTLS strategy", () => {
            const strategies = [{ type: ORD_ACCESS_STRATEGY.CfMtls }];
            expect(hasNonOpenStrategies(strategies)).toBe(true);
        });

        it("should return true for mixed strategies including non-open", () => {
            const strategies = [{ type: ORD_ACCESS_STRATEGY.Open }, { type: ORD_ACCESS_STRATEGY.Basic }];
            expect(hasNonOpenStrategies(strategies)).toBe(true);
        });
    });

    describe("ensureNoOpenWhenNonOpenPresent", () => {
        it("should not throw for empty array", () => {
            expect(() => ensureNoOpenWhenNonOpenPresent([])).not.toThrow();
        });

        it("should not throw for only open strategy", () => {
            const strategies = [{ type: ORD_ACCESS_STRATEGY.Open }];
            expect(() => ensureNoOpenWhenNonOpenPresent(strategies)).not.toThrow();
        });

        it("should not throw for only non-open strategies", () => {
            const strategies = [{ type: ORD_ACCESS_STRATEGY.Basic }, { type: ORD_ACCESS_STRATEGY.CfMtls }];
            expect(() => ensureNoOpenWhenNonOpenPresent(strategies)).not.toThrow();
        });

        it("should throw when open coexists with basic", () => {
            const strategies = [{ type: ORD_ACCESS_STRATEGY.Open }, { type: ORD_ACCESS_STRATEGY.Basic }];
            expect(() => ensureNoOpenWhenNonOpenPresent(strategies)).toThrow(/cannot coexist/);
        });

        it("should throw when open coexists with CF mTLS", () => {
            const strategies = [{ type: ORD_ACCESS_STRATEGY.Open }, { type: ORD_ACCESS_STRATEGY.CfMtls }];
            expect(() => ensureNoOpenWhenNonOpenPresent(strategies)).toThrow(/cannot coexist/);
        });

        it("should throw when open coexists with multiple non-open strategies", () => {
            const strategies = [
                { type: ORD_ACCESS_STRATEGY.Basic },
                { type: ORD_ACCESS_STRATEGY.Open },
                { type: ORD_ACCESS_STRATEGY.CfMtls },
            ];
            expect(() => ensureNoOpenWhenNonOpenPresent(strategies)).toThrow(/cannot coexist/);
        });
    });

    describe("ensureAccessStrategies", () => {
        describe("non-strict mode (default)", () => {
            beforeEach(() => {
                cds.env.ord = { strictAccessStrategies: false };
            });

            it("should return strategies if provided", () => {
                const strategies = [{ type: ORD_ACCESS_STRATEGY.Basic }];
                const result = ensureAccessStrategies(strategies, { resourceName: "TestAPI" });

                expect(result).toEqual(strategies);
            });

            it("should fallback to open for undefined strategies", () => {
                const result = ensureAccessStrategies(undefined, { resourceName: "TestAPI" });

                expect(result).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
            });

            it("should fallback to open for empty array", () => {
                const result = ensureAccessStrategies([], { resourceName: "TestAPI" });

                expect(result).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
            });

            it("should fallback to open for null", () => {
                const result = ensureAccessStrategies(null, { resourceName: "TestAPI" });

                expect(result).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
            });

            it("should validate and return valid strategies", () => {
                const strategies = [{ type: ORD_ACCESS_STRATEGY.Basic }, { type: ORD_ACCESS_STRATEGY.CfMtls }];
                const result = ensureAccessStrategies(strategies, { resourceName: "TestAPI" });

                expect(result).toEqual(strategies);
            });
        });

        describe("strict mode", () => {
            beforeEach(() => {
                cds.env.ord = { strictAccessStrategies: true };
            });

            it("should return strategies if provided", () => {
                const strategies = [{ type: ORD_ACCESS_STRATEGY.Basic }];
                const result = ensureAccessStrategies(strategies, { resourceName: "TestAPI" });

                expect(result).toEqual(strategies);
            });

            it("should throw for undefined strategies in strict mode", () => {
                expect(() => {
                    ensureAccessStrategies(undefined, { resourceName: "TestAPI" });
                }).toThrow(/Strict mode is enabled/);
            });

            it("should throw for empty array in strict mode", () => {
                expect(() => {
                    ensureAccessStrategies([], { resourceName: "TestAPI" });
                }).toThrow(/Strict mode is enabled/);
            });

            it("should throw for null in strict mode", () => {
                expect(() => {
                    ensureAccessStrategies(null, { resourceName: "TestAPI" });
                }).toThrow(/Strict mode is enabled/);
            });

            it("should include resource name in error message", () => {
                expect(() => {
                    ensureAccessStrategies(undefined, { resourceName: "MyCustomAPI" });
                }).toThrow(/MyCustomAPI/);
            });
        });

        describe("explicit strict parameter", () => {
            it("should use explicit strict=true even if config is false", () => {
                cds.env.ord = { strictAccessStrategies: false };

                expect(() => {
                    ensureAccessStrategies(undefined, { resourceName: "TestAPI", strict: true });
                }).toThrow(/Strict mode is enabled/);
            });

            it("should use explicit strict=false even if config is true", () => {
                cds.env.ord = { strictAccessStrategies: true };

                const result = ensureAccessStrategies(undefined, { resourceName: "TestAPI", strict: false });

                expect(result).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
            });
        });

        describe("validation of strategies", () => {
            it("should throw if open coexists with non-open strategies", () => {
                const strategies = [{ type: ORD_ACCESS_STRATEGY.Open }, { type: ORD_ACCESS_STRATEGY.Basic }];

                expect(() => {
                    ensureAccessStrategies(strategies, { resourceName: "TestAPI" });
                }).toThrow(/cannot coexist/);
            });

            it("should allow multiple non-open strategies", () => {
                const strategies = [{ type: ORD_ACCESS_STRATEGY.Basic }, { type: ORD_ACCESS_STRATEGY.CfMtls }];

                const result = ensureAccessStrategies(strategies, { resourceName: "TestAPI" });

                expect(result).toEqual(strategies);
            });
        });
    });

    describe("isValidAccessStrategies", () => {
        it("should return false for empty array", () => {
            expect(isValidAccessStrategies([])).toBe(false);
        });

        it("should return false for undefined", () => {
            expect(isValidAccessStrategies(undefined)).toBe(false);
        });

        it("should return false for null", () => {
            expect(isValidAccessStrategies(null)).toBe(false);
        });

        it("should return true for valid open strategy", () => {
            const strategies = [{ type: ORD_ACCESS_STRATEGY.Open }];
            expect(isValidAccessStrategies(strategies)).toBe(true);
        });

        it("should return true for valid basic strategy", () => {
            const strategies = [{ type: ORD_ACCESS_STRATEGY.Basic }];
            expect(isValidAccessStrategies(strategies)).toBe(true);
        });

        it("should return true for valid CF mTLS strategy", () => {
            const strategies = [{ type: ORD_ACCESS_STRATEGY.CfMtls }];
            expect(isValidAccessStrategies(strategies)).toBe(true);
        });

        it("should return true for multiple valid strategies", () => {
            const strategies = [{ type: ORD_ACCESS_STRATEGY.Basic }, { type: ORD_ACCESS_STRATEGY.CfMtls }];
            expect(isValidAccessStrategies(strategies)).toBe(true);
        });

        it("should return false for invalid strategy type", () => {
            const strategies = [{ type: "invalid-type" }];
            expect(isValidAccessStrategies(strategies)).toBe(false);
        });

        it("should return false if any strategy is invalid", () => {
            const strategies = [{ type: ORD_ACCESS_STRATEGY.Basic }, { type: "invalid-type" }];
            expect(isValidAccessStrategies(strategies)).toBe(false);
        });

        it("should return false for strategy without type property", () => {
            const strategies = [{ notType: "something" }];
            expect(isValidAccessStrategies(strategies)).toBe(false);
        });
    });

    describe("Integration scenarios", () => {
        it("should handle complete flow from auth config to validated strategies", () => {
            const authConfig = {
                types: [AUTHENTICATION_TYPE.Basic, AUTHENTICATION_TYPE.CfMtls],
            };

            const strategies = getAccessStrategiesFromAuthConfig(authConfig);
            const validated = ensureAccessStrategies(strategies, { resourceName: "TestAPI" });

            expect(validated).toEqual([{ type: ORD_ACCESS_STRATEGY.Basic }, { type: ORD_ACCESS_STRATEGY.CfMtls }]);
            expect(hasNonOpenStrategies(validated)).toBe(true);
            expect(isValidAccessStrategies(validated)).toBe(true);
        });

        it("should handle open-only configuration", () => {
            const authConfig = { types: [AUTHENTICATION_TYPE.Open] };

            const strategies = getAccessStrategiesFromAuthConfig(authConfig);
            const validated = ensureAccessStrategies(strategies, { resourceName: "TestAPI" });

            expect(validated).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
            expect(hasNonOpenStrategies(validated)).toBe(false);
            expect(isValidAccessStrategies(validated)).toBe(true);
        });

        it("should handle missing config with non-strict fallback", () => {
            cds.env.ord = { strictAccessStrategies: false };

            const strategies = getAccessStrategiesFromAuthConfig(undefined);
            const validated = ensureAccessStrategies(strategies, { resourceName: "TestAPI" });

            expect(validated).toEqual([{ type: ORD_ACCESS_STRATEGY.Open }]);
            expect(isValidAccessStrategies(validated)).toBe(true);
        });
    });
});
