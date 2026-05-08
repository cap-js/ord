const cds = require("@sap/cds");
const { createAPIResourceTemplate, createEventResourceTemplate } = require("../../lib/templates");

describe("namespace local and global", () => {
    it("should strip application namespace from local namespace", () => {
        const appConfig = {
            ordNamespace: "customer.testNamespace",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
        const serviceName = "MyService";
        const testNamespace = "customer.testNamespace.nested.";
        const model = cds.linked(`
                namespace customer.testNamespace.nested;

                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                };
                annotate MyService with @ORD.Extensions : {
                    visibility : 'public'
                };
            `);
        const packageIds = ["sap.test.cdsrc.sample:package:test-event:v1", "sap.test.cdsrc.sample:package:test-api:v1"];
        const srvDefinition = model.definitions[testNamespace + serviceName];
        expect(createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        expect(createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
    });

    it("should strip application namespace if its the same as local namespace", () => {
        const appConfig = {
            ordNamespace: "customer.testNamespace",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
        const serviceName = "MyService";
        const testNamespace = "customer.testNamespace.";
        const model = cds.linked(`
                namespace customer.testNamespace;

                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                };
                annotate MyService with @ORD.Extensions : {
                    visibility : 'public'
                };
            `);
        const packageIds = ["sap.test.cdsrc.sample:package:test-event:v1", "sap.test.cdsrc.sample:package:test-api:v1"];
        const srvDefinition = model.definitions[testNamespace + serviceName];
        expect(createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        expect(createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
    });

    it("should not strip a different local namespace", () => {
        const appConfig = {
            ordNamespace: "customer.testNamespace",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
        const serviceName = "MyService";
        const testNamespace = "other.namespace.";
        const model = cds.linked(`
                namespace other.namespace;

                service MyService {
                    entity Books {
                        key ID: UUID;
                        title: String;
                    }
                };
                annotate MyService with @ORD.Extensions : {
                    visibility : 'public'
                };
            `);
        const packageIds = ["sap.test.cdsrc.sample:package:test-event:v1", "sap.test.cdsrc.sample:package:test-api:v1"];
        const srvDefinition = model.definitions[testNamespace + serviceName];
        expect(createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        expect(createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds)).toMatchSnapshot();
    });

    it("should strip internalNamespace when it differs from ordNamespace", () => {
        const appConfig = {
            ordNamespace: "sap.sourcing",
            internalNamespace: "com.sap.sourcing.api.v1",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
        const serviceName = "SourcingService";
        const model = cds.linked(`
            namespace com.sap.sourcing.api.v1;
            service SourcingService {
                entity Orders { key ID: UUID; }
            };
            annotate SourcingService with @ORD.Extensions : { visibility : 'public' };
        `);
        const packageIds = ["sap.test.cdsrc.sample:package:test-event:v1", "sap.test.cdsrc.sample:package:test-api:v1"];
        const srvDefinition = model.definitions["com.sap.sourcing.api.v1.SourcingService"];

        const apiResult = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);
        expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:SourcingService:v1");
        expect(apiResult[0].partOfGroups[0]).toBe("sap.cds:service:sap.sourcing:SourcingService");

        const eventResult = createEventResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);
        expect(eventResult[0].ordId).toBe("sap.sourcing:eventResource:SourcingService:v1");
    });

    it("should strip internalNamespace and handle leading dot for sub-namespaces", () => {
        // Same substring(1) / startsWith(".") behavior as ordNamespace stripping
        const appConfig = {
            ordNamespace: "sap.sourcing",
            internalNamespace: "com.sap.sourcing",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
        const serviceName = "SourcingService";
        const model = cds.linked(`
            namespace com.sap.sourcing.nested;
            service SourcingService {
                entity Orders { key ID: UUID; }
            };
            annotate SourcingService with @ORD.Extensions : { visibility : 'public' };
        `);
        const packageIds = ["sap.test.cdsrc.sample:package:test-event:v1", "sap.test.cdsrc.sample:package:test-api:v1"];
        const srvDefinition = model.definitions["com.sap.sourcing.nested.SourcingService"];

        const apiResult = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);
        expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:nested.SourcingService:v1");
    });

    it("should prefer ordNamespace over internalNamespace when both could match", () => {
        const appConfig = {
            ordNamespace: "sap.sourcing",
            internalNamespace: "sap.sourcing.internal",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
        const serviceName = "BillingService";
        const model = cds.linked(`
            namespace sap.sourcing.nested;
            service BillingService {
                entity Invoices { key ID: UUID; }
            };
            annotate BillingService with @ORD.Extensions : { visibility : 'public' };
        `);
        const packageIds = ["sap.test.cdsrc.sample:package:test-event:v1", "sap.test.cdsrc.sample:package:test-api:v1"];
        const srvDefinition = model.definitions["sap.sourcing.nested.BillingService"];

        const apiResult = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);
        expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:nested.BillingService:v1");
    });

    it("should not strip when neither ordNamespace nor internalNamespace matches", () => {
        const appConfig = {
            ordNamespace: "sap.sourcing",
            internalNamespace: "com.sap.sourcing.api.v1",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
        const serviceName = "MyService";
        const model = cds.linked(`
            namespace other.namespace;
            service MyService {
                entity Orders { key ID: UUID; }
            };
            annotate MyService with @ORD.Extensions : { visibility : 'public' };
        `);
        const packageIds = ["sap.test.cdsrc.sample:package:test-event:v1", "sap.test.cdsrc.sample:package:test-api:v1"];
        const srvDefinition = model.definitions["other.namespace.MyService"];

        const apiResult = createAPIResourceTemplate(serviceName, srvDefinition, appConfig, packageIds);
        expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:other.namespace.MyService:v1");
    });
});
