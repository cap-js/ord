const cds = require("@sap/cds");
const { ORD_API_PROTOCOL } = require("../../lib/constants");
const { resolveApiResourceProtocol, _getExplicitProtocols } = require("../../lib/protocol-resolver");
const { isPrimaryDataProductService } = require("../../lib/templates");
const Logger = require("../../lib/logger");

describe("protocol-resolver", () => {
    describe("_getExplicitProtocols", () => {
        it("should return empty array when no @protocol annotation", () => {
            const srvDefinition = { name: "MyService" };
            expect(_getExplicitProtocols(srvDefinition)).toEqual([]);
        });

        it("should return array for string protocol", () => {
            const srvDefinition = { "name": "MyService", "@protocol": "rest" };
            expect(_getExplicitProtocols(srvDefinition)).toEqual(["rest"]);
        });

        it("should return array as-is for array protocol", () => {
            const srvDefinition = { "name": "MyService", "@protocol": ["odata", "rest"] };
            expect(_getExplicitProtocols(srvDefinition)).toEqual(["odata", "rest"]);
        });

        it("should handle single-item array", () => {
            const srvDefinition = { "name": "MyService", "@protocol": ["graphql"] };
            expect(_getExplicitProtocols(srvDefinition)).toEqual(["graphql"]);
        });
    });

    describe("resolveApiResourceProtocol", () => {
        let loggerWarnSpy;

        beforeEach(() => {
            loggerWarnSpy = jest.spyOn(Logger, "warn").mockImplementation(() => {});
        });

        afterEach(() => {
            loggerWarnSpy.mockRestore();
        });

        it("should return odata-v4 for default OData service without explicit protocol", () => {
            const model = cds.linked(`
                service MyService {
                    entity Books { key ID: UUID; }
                }
            `);
            const srvDefinition = model.definitions["MyService"];
            const result = resolveApiResourceProtocol("MyService", srvDefinition, {
                isPrimaryDataProduct: isPrimaryDataProductService,
            });

            expect(result).toHaveLength(1);
            expect(result[0].apiProtocol).toBe(ORD_API_PROTOCOL.ODATA_V4);
            expect(result[0].hasResourceDefinitions).toBe(true);
            expect(result[0].entryPoints).not.toContain(null);
        });

        it("should return empty array for unknown explicit protocol", () => {
            const srvDefinition = {
                "name": "MyService",
                "@protocol": "unknown-protocol",
            };
            const result = resolveApiResourceProtocol("MyService", srvDefinition, {
                isPrimaryDataProduct: isPrimaryDataProductService,
            });

            expect(result).toEqual([]);
            expect(loggerWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining("Unknown protocol 'unknown-protocol' is not supported"),
            );
        });

        it("should handle INA protocol as ORD-only protocol", () => {
            const srvDefinition = {
                "name": "INAService",
                "@protocol": "ina",
            };
            const result = resolveApiResourceProtocol("INAService", srvDefinition, {
                isPrimaryDataProduct: isPrimaryDataProductService,
            });

            expect(result).toHaveLength(1);
            expect(result[0].apiProtocol).toBe(ORD_API_PROTOCOL.SAP_INA);
            expect(result[0].entryPoints).toEqual([]);
            expect(result[0].hasResourceDefinitions).toBe(false);
        });

        it("should warn and skip GraphQL protocol", () => {
            const srvDefinition = {
                "name": "GraphQLService",
                "@protocol": "graphql",
            };
            const result = resolveApiResourceProtocol("GraphQLService", srvDefinition, {
                isPrimaryDataProduct: isPrimaryDataProductService,
            });

            expect(result).toEqual([]);
            expect(loggerWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining("plugin cannot generate its resource definitions yet"),
            );
        });

        it("should return data subscription protocol for primary data product service", () => {
            const srvDefinition = {
                "name": "DataProductService",
                "@DataIntegration.dataProduct.type": "primary",
            };
            const result = resolveApiResourceProtocol("DataProductService", srvDefinition, {
                isPrimaryDataProduct: isPrimaryDataProductService,
            });

            expect(result).toHaveLength(1);
            expect(result[0].apiProtocol).toBe(ORD_API_PROTOCOL.SAP_DATA_SUBSCRIPTION);
            expect(result[0].entryPoints).toEqual([]);
            expect(result[0].hasResourceDefinitions).toBe(true);
        });

        it("should never produce [null] in entryPoints (Rule C)", () => {
            const testCases = [
                { "name": "Svc1", "@protocol": "ina" },
                { "name": "Svc2", "@DataIntegration.dataProduct.type": "primary" },
                { name: "Svc3" },
            ];

            testCases.forEach((srvDefinition) => {
                const result = resolveApiResourceProtocol(srvDefinition.name, srvDefinition, {
                    isPrimaryDataProduct: isPrimaryDataProductService,
                });
                result.forEach((r) => {
                    expect(r.entryPoints).not.toContain(null);
                    expect(r.entryPoints).not.toContain(undefined);
                });
            });
        });

        it("should not fallback to OData when explicit protocol is set (Rule A)", () => {
            const srvDefinition = {
                "name": "CustomService",
                "@protocol": "custom-protocol",
            };
            const result = resolveApiResourceProtocol("CustomService", srvDefinition, {
                isPrimaryDataProduct: isPrimaryDataProductService,
            });

            expect(result).toEqual([]);
            const hasOData = result.some((r) => r.apiProtocol === ORD_API_PROTOCOL.ODATA_V4);
            expect(hasOData).toBe(false);
        });

        it("should only fallback to OData when no explicit protocol (Rule B)", () => {
            const model = cds.linked(`
                service DefaultService {
                    entity Items { key ID: UUID; }
                }
            `);
            const srvDefinition = model.definitions["DefaultService"];
            const result = resolveApiResourceProtocol("DefaultService", srvDefinition, {
                isPrimaryDataProduct: isPrimaryDataProductService,
            });

            expect(result).toHaveLength(1);
            expect(result[0].apiProtocol).toBe(ORD_API_PROTOCOL.ODATA_V4);
        });

        it("should support multi-protocol scenarios (e.g., @protocol: ['ina', 'odata'])", () => {
            const model = cds.linked(`
                @protocol: ['ina', 'odata']
                service MultiProtocolService {
                    entity Items { key ID: UUID; }
                }
            `);
            const srvDefinition = model.definitions["MultiProtocolService"];
            const result = resolveApiResourceProtocol("MultiProtocolService", srvDefinition, {
                isPrimaryDataProduct: isPrimaryDataProductService,
            });

            // Should return both INA and OData protocols
            expect(result.length).toBeGreaterThanOrEqual(1);

            // Check for INA protocol (ORD-only)
            const inaResult = result.find((r) => r.apiProtocol === ORD_API_PROTOCOL.SAP_INA);
            expect(inaResult).toBeDefined();
            expect(inaResult.hasResourceDefinitions).toBe(false);

            // Check for OData protocol (CAP-served)
            const odataResult = result.find((r) => r.apiProtocol === ORD_API_PROTOCOL.ODATA_V4);
            expect(odataResult).toBeDefined();
            expect(odataResult.hasResourceDefinitions).toBe(true);

            // Verify no null in entryPoints (Rule C)
            result.forEach((r) => {
                expect(r.entryPoints).not.toContain(null);
                expect(r.entryPoints).not.toContain(undefined);
            });
        });

        it("should support @protocol: ['odata', 'rest'] multi-protocol", () => {
            const model = cds.linked(`
                @protocol: ['odata', 'rest']
                service DualProtocolService {
                    entity Items { key ID: UUID; }
                }
            `);
            const srvDefinition = model.definitions["DualProtocolService"];
            const result = resolveApiResourceProtocol("DualProtocolService", srvDefinition, {
                isPrimaryDataProduct: isPrimaryDataProductService,
            });

            // Should return both OData and REST protocols
            expect(result.length).toBe(2);

            const protocols = result.map((r) => r.apiProtocol);
            expect(protocols).toContain(ORD_API_PROTOCOL.ODATA_V4);
            expect(protocols).toContain(ORD_API_PROTOCOL.REST);

            // Both should have resource definitions
            result.forEach((r) => {
                expect(r.hasResourceDefinitions).toBe(true);
                expect(r.entryPoints).not.toContain(null);
            });
        });
    });
});
