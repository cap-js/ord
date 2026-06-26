const cds = require("@sap/cds");

const Logger = require("../../lib/logger");
const { ORD_API_PROTOCOL } = require("../../lib/constants");
const { resolveApiResourceProtocol } = require("../../lib/protocol-resolver");

describe("protocol-resolver", () => {
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
            const result = resolveApiResourceProtocol(srvDefinition);

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
            const result = resolveApiResourceProtocol(srvDefinition);

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
            const result = resolveApiResourceProtocol(srvDefinition);

            expect(result).toHaveLength(1);
            expect(result[0].apiProtocol).toBe(ORD_API_PROTOCOL.SAP_INA);
            expect(result[0].entryPoints).toEqual([]);
            expect(result[0].hasResourceDefinitions).toBe(false);
        });

        it("should silently skip GraphQL protocol when plugin is not loaded", () => {
            const srvDefinition = {
                "name": "GraphQLService",
                "@protocol": "graphql",
            };
            const result = resolveApiResourceProtocol(srvDefinition);

            expect(result).toEqual([]);
            expect(loggerWarnSpy).not.toHaveBeenCalled();
        });

        it("should return data subscription protocol for primary data product service", () => {
            const srvDefinition = {
                "name": "DataProductService",
                "@DataIntegration.dataProduct.type": "primary",
            };
            const result = resolveApiResourceProtocol(srvDefinition);

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
                const result = resolveApiResourceProtocol(srvDefinition);
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
            const result = resolveApiResourceProtocol(srvDefinition);

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
            const result = resolveApiResourceProtocol(srvDefinition);

            expect(result).toHaveLength(1);
            expect(result[0].apiProtocol).toBe(ORD_API_PROTOCOL.ODATA_V4);
        });

        it("should handle multiple explicit protocols and include OData if present", () => {
            const model = cds.linked(`
                @protocol: ['rest', 'odata']
                service MyService {
                    entity Books { key ID: UUID; }
                }
            `);
            const srvDefinition = model.definitions["MyService"];
            const result = resolveApiResourceProtocol(srvDefinition);

            expect(result).toHaveLength(2);
            const protocols = result.map((r) => r.apiProtocol);
            expect(protocols).toContain(ORD_API_PROTOCOL.REST);
            expect(protocols).toContain(ORD_API_PROTOCOL.ODATA_V4);
        });

        it("should handle multiple explicit protocols and skip unsupported ones", () => {
            const model = cds.linked(`
                @protocol: ['rest', 'graphql', 'unknown-protocol']
                service MyService {
                    entity Books { key ID: UUID; }
                }
            `);
            const srvDefinition = model.definitions["MyService"];
            const result = resolveApiResourceProtocol(srvDefinition);

            expect(result).toHaveLength(1);
            expect(result[0].apiProtocol).toBe(ORD_API_PROTOCOL.REST);
            expect(loggerWarnSpy).not.toHaveBeenCalledWith(expect.stringContaining("Unknown protocol 'graphql'"));
            expect(loggerWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining("Unknown protocol 'unknown-protocol' is not supported"),
            );
        });

        it("should handle ina protocol even if other protocols are present", () => {
            const model = cds.linked(`
                @protocol: ['rest', 'graphql', 'ina']
                service MyService {
                    entity Books { key ID: UUID; }
                }
            `);
            const srvDefinition = model.definitions["MyService"];
            const result = resolveApiResourceProtocol(srvDefinition);
            expect(result).toHaveLength(2);
            const inaProtocol = result.find((r) => r.apiProtocol === ORD_API_PROTOCOL.SAP_INA);
            expect(inaProtocol).toBeDefined();
            expect(inaProtocol.entryPoints).toEqual([]);
            expect(inaProtocol.hasResourceDefinitions).toBe(false);
        });

        // GraphQL protocol tests (with @cap-js/graphql plugin loaded)
        describe("with @cap-js/graphql plugin loaded", () => {
            beforeEach(() => {
                cds.service.protocols["graphql"] = { path: "/graphql", impl: "@cap-js/graphql" };
            });

            afterEach(() => {
                delete cds.service.protocols["graphql"];
            });

            it("should resolve GraphQL protocol", () => {
                const model = cds.linked(`
                    @protocol: 'graphql'
                    service GraphQLService {
                        entity Books { key ID: UUID; }
                    }
                `);
                const srvDefinition = model.definitions["GraphQLService"];
                const result = resolveApiResourceProtocol(srvDefinition);

                expect(result).toHaveLength(1);
                expect(result[0].apiProtocol).toBe(ORD_API_PROTOCOL.GRAPHQL);
                expect(result[0].hasResourceDefinitions).toBe(true);
                expect(result[0].entryPoints).not.toContain(null);
            });

            it("should handle multiple protocols including GraphQL", () => {
                const model = cds.linked(`
                    @protocol: ['rest', 'graphql', 'unknown-protocol']
                    service MyService {
                        entity Books { key ID: UUID; }
                    }
                `);
                const srvDefinition = model.definitions["MyService"];
                const result = resolveApiResourceProtocol(srvDefinition);

                expect(result).toHaveLength(2);
                const protocols = result.map((r) => r.apiProtocol);
                expect(protocols).toContain(ORD_API_PROTOCOL.REST);
                expect(protocols).toContain(ORD_API_PROTOCOL.GRAPHQL);
                expect(loggerWarnSpy).toHaveBeenCalledWith(
                    expect.stringContaining("Unknown protocol 'unknown-protocol' is not supported"),
                );
            });

            it("should handle ina and graphql protocols together", () => {
                const model = cds.linked(`
                    @protocol: ['rest', 'graphql', 'ina']
                    service MyService {
                        entity Books { key ID: UUID; }
                    }
                `);
                const srvDefinition = model.definitions["MyService"];
                const result = resolveApiResourceProtocol(srvDefinition);
                expect(result).toHaveLength(3);
                const protocols = result.map((r) => r.apiProtocol);
                expect(protocols).toContain(ORD_API_PROTOCOL.REST);
                expect(protocols).toContain(ORD_API_PROTOCOL.GRAPHQL);
                expect(protocols).toContain(ORD_API_PROTOCOL.SAP_INA);
                const inaProtocol = result.find((r) => r.apiProtocol === ORD_API_PROTOCOL.SAP_INA);
                expect(inaProtocol.entryPoints).toEqual([]);
                expect(inaProtocol.hasResourceDefinitions).toBe(false);
            });
        });

        describe("with custom CAP protocol plugin loaded", () => {
            beforeEach(() => {
                cds.service.protocols["custom_protocol"] = {
                    path: "/custom-protocol",
                    impl: "@example/custom-protocol",
                };
            });

            afterEach(() => {
                delete cds.service.protocols["custom_protocol"];
            });

            it("should not crash and should warn for unknown CAP-registered protocol", () => {
                const model = cds.linked(`
                    @protocol: 'custom_protocol'
                    service CustomService {
                        entity Things { key ID: UUID; }
                    }
                `);
                const srvDefinition = model.definitions["CustomService"];

                expect(() => resolveApiResourceProtocol(srvDefinition)).not.toThrow();
                const result = resolveApiResourceProtocol(srvDefinition);
                expect(result).toEqual([]);
                expect(loggerWarnSpy).toHaveBeenCalledWith(
                    expect.stringContaining("Unknown protocol 'custom_protocol' is not supported"),
                );
            });

            it("should keep known protocols and drop unknown CAP-registered protocol", () => {
                const model = cds.linked(`
                    @protocol: ['rest', 'custom_protocol']
                    service MixedService {
                        entity Things { key ID: UUID; }
                    }
                `);
                const srvDefinition = model.definitions["MixedService"];
                const result = resolveApiResourceProtocol(srvDefinition);

                expect(result).toHaveLength(1);
                expect(result[0].apiProtocol).toBe(ORD_API_PROTOCOL.REST);
                expect(loggerWarnSpy).toHaveBeenCalledWith(
                    expect.stringContaining("Unknown protocol 'custom_protocol' is not supported"),
                );
            });
        });
    });
});
