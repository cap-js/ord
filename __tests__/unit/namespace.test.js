const cds = require("@sap/cds");
const { createAPIResourceTemplate, createEventResourceTemplate } = require("../../lib/templates");

describe("namespace local and global", () => {
    it("should strip application namespace from local namespace", () => {
        const appConfig = {
            ordNamespace: "customer.testNamespace",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
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
        const srvDefinition = model.definitions["customer.testNamespace.nested.MyService"];
        expect(createAPIResourceTemplate(srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        expect(createEventResourceTemplate(srvDefinition, appConfig, packageIds)).toMatchSnapshot();
    });

    it("should strip application namespace if its the same as local namespace", () => {
        const appConfig = {
            ordNamespace: "customer.testNamespace",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
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
        const srvDefinition = model.definitions["customer.testNamespace.MyService"];
        expect(createAPIResourceTemplate(srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        expect(createEventResourceTemplate(srvDefinition, appConfig, packageIds)).toMatchSnapshot();
    });

    it("should not strip a different local namespace", () => {
        const appConfig = {
            ordNamespace: "customer.testNamespace",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
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
        const srvDefinition = model.definitions["other.namespace.MyService"];
        expect(createAPIResourceTemplate(srvDefinition, appConfig, packageIds)).toMatchSnapshot();
        expect(createEventResourceTemplate(srvDefinition, appConfig, packageIds)).toMatchSnapshot();
    });

    it("should strip internalNamespace when it differs from ordNamespace", () => {
        const appConfig = {
            ordNamespace: "sap.sourcing",
            internalNamespace: "com.sap.sourcing.api.v1",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
        const model = cds.linked(`
            namespace com.sap.sourcing.api.v1;
            service SourcingService {
                entity Orders { key ID: UUID; }
            };
            annotate SourcingService with @ORD.Extensions : { visibility : 'public' };
        `);
        const packageIds = ["sap.test.cdsrc.sample:package:test-event:v1", "sap.test.cdsrc.sample:package:test-api:v1"];
        const srvDefinition = model.definitions["com.sap.sourcing.api.v1.SourcingService"];

        const apiResult = createAPIResourceTemplate(srvDefinition, appConfig, packageIds);
        expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:SourcingService:v1");
        expect(apiResult[0].partOfGroups[0]).toBe("sap.cds:service:sap.sourcing:SourcingService");

        const eventResult = createEventResourceTemplate(srvDefinition, appConfig, packageIds);

        expect(eventResult[0].ordId).toBe("sap.sourcing:eventResource:SourcingService:v1");
    });

    it("should strip internalNamespace and handle leading dot for sub-namespaces", () => {
        const appConfig = {
            ordNamespace: "sap.sourcing",
            internalNamespace: "com.sap.sourcing",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
        const model = cds.linked(`
            namespace com.sap.sourcing.nested;
            service SourcingService {
                entity Orders { key ID: UUID; }
            };
            annotate SourcingService with @ORD.Extensions : { visibility : 'public' };
        `);
        const packageIds = ["sap.test.cdsrc.sample:package:test-event:v1", "sap.test.cdsrc.sample:package:test-api:v1"];
        const srvDefinition = model.definitions["com.sap.sourcing.nested.SourcingService"];

        const apiResult = createAPIResourceTemplate(srvDefinition, appConfig, packageIds);
        expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:nested.SourcingService:v1");
    });

    it("should prefer internalNamespace over ordNamespace when both could match", () => {
        const appConfig = {
            ordNamespace: "sap.sourcing",
            internalNamespace: "sap.sourcing.internal",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
        const model = cds.linked(`
            namespace sap.sourcing.internal;
            service BillingService {
                entity Invoices { key ID: UUID; }
            };
            annotate BillingService with @ORD.Extensions : { visibility : 'public' };
        `);
        const packageIds = ["sap.test.cdsrc.sample:package:test-event:v1", "sap.test.cdsrc.sample:package:test-api:v1"];
        const srvDefinition = model.definitions["sap.sourcing.internal.BillingService"];

        const apiResult = createAPIResourceTemplate(srvDefinition, appConfig, packageIds);
        expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:BillingService:v1");
    });

    it("should not strip a partial ordNamespace match (dot-boundary guard)", () => {
        const appConfig = {
            ordNamespace: "sap.sourcing",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
        const model = cds.linked(`
            namespace sap.sourcingExtra;
            service SomeService {
                entity Foo { key ID: UUID; }
            };
            annotate SomeService with @ORD.Extensions : { visibility : 'public' };
        `);
        const packageIds = ["sap.test.cdsrc.sample:package:test-event:v1", "sap.test.cdsrc.sample:package:test-api:v1"];
        const srvDefinition = model.definitions["sap.sourcingExtra.SomeService"];

        const apiResult = createAPIResourceTemplate(srvDefinition, appConfig, packageIds);
        expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:sap.sourcingExtra.SomeService:v1");
    });

    it("should not strip a partial internalNamespace match (dot-boundary guard)", () => {
        const appConfig = {
            ordNamespace: "sap.sourcing",
            internalNamespace: "com.sap.sourcing",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
        const model = cds.linked(`
            namespace com.sap.sourcingExtra;
            service SomeService {
                entity Foo { key ID: UUID; }
            };
            annotate SomeService with @ORD.Extensions : { visibility : 'public' };
        `);
        const packageIds = ["sap.test.cdsrc.sample:package:test-event:v1", "sap.test.cdsrc.sample:package:test-api:v1"];
        const srvDefinition = model.definitions["com.sap.sourcingExtra.SomeService"];

        const apiResult = createAPIResourceTemplate(srvDefinition, appConfig, packageIds);
        expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:com.sap.sourcingExtra.SomeService:v1");
    });

    it("should not strip when neither ordNamespace nor internalNamespace matches", () => {
        const appConfig = {
            ordNamespace: "sap.sourcing",
            internalNamespace: "com.sap.sourcing.api.v1",
            appName: "testAppName",
            lastUpdate: "2022-12-19T15:47:04+00:00",
        };
        const model = cds.linked(`
            namespace other.namespace;
            service MyService {
                entity Orders { key ID: UUID; }
            };
            annotate MyService with @ORD.Extensions : { visibility : 'public' };
        `);
        const packageIds = ["sap.test.cdsrc.sample:package:test-event:v1", "sap.test.cdsrc.sample:package:test-api:v1"];
        const srvDefinition = model.definitions["other.namespace.MyService"];

        const apiResult = createAPIResourceTemplate(srvDefinition, appConfig, packageIds);
        expect(apiResult[0].ordId).toBe("sap.sourcing:apiResource:other.namespace.MyService:v1");
    });
});
