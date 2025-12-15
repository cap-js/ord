const cds = require("@sap/cds");
const { mockCdsContext } = require("./utils/test-helpers");

// Mock CDS context with open authentication
mockCdsContext(cds);
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
});
