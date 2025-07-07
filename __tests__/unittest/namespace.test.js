const cds = require("@sap/cds");
const {
    AUTHENTICATION_TYPE,
    ORD_ODM_ENTITY_NAME_ANNOTATION,
    ENTITY_RELATIONSHIP_ANNOTATION,
    ORD_EXTENSIONS_PREFIX,
    RESOURCE_VISIBILITY,
} = require("../../lib/constants");

jest.spyOn(cds, "context", "get").mockReturnValue({
    authConfig: {
        types: [AUTHENTICATION_TYPE.Open],
    },
});
const { createAPIResourceTemplate } = require("../../lib/templates");

describe("namespace", () => {
    it("should have namespace", () => {
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
    });
});
