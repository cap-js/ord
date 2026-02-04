const cds = require("@sap/cds");
const { ORD_API_PROTOCOL } = require("../../lib/constants");
const { resolveApiResourceProtocol, _getExplicitProtocols } = require("../../lib/protocol-resolver");
const { isPrimaryDataProductService } = require("../../lib/templates");
const Logger = require("../../lib/logger");

describe("protocol-resolver", () => {
    describe("_getExplicitProtocols", () => {
        it("should return null when no @protocol annotation", () => {
            const srvDefinition = { name: "MyService" };
            expect(_getExplicitProtocols(srvDefinition)).toBeNull();
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
                { "name": "Svc3" },
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
    });
});
