const cds = require("@sap/cds");

const { ORD_EXTENSIONS_PREFIX, RESOURCE_VISIBILITY } = require("../../lib/constants");
const Configuration = require("../../lib/configuration");

describe("templates", () => {
    let linkedModel;

    beforeAll(() => {
        linkedModel = cds.linked(`
            namespace customer.testNamespace123;
            entity Books {
                key ID: UUID;
                title: String;
            }
        `);
    });

    describe("propagateORDVisibility", () => {
        it("should propagate visibility private", () => {
            linkedModel = cds.linked(`
                entity AppCustomers {
                    key ID         : String;
                    addresses      : Composition of many Addresses on addresses.customer = $self;
                }

                @ODM.entityName: 'CompositionOdmEntity'
                entity Addresses {
                    customer       : Association to AppCustomers;
                }

                service MyService {
                    entity Customers as projection on AppCustomers;
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                }
                annotate MyService with @ORD.Extensions : {
                    visibility : 'private',
                };
            `);
            const model = new Configuration(linkedModel).csn;
            const eventDefinition = model.definitions["MyService.ServiceEvent"];
            expect(eventDefinition[ORD_EXTENSIONS_PREFIX + "visibility"]).toEqual(RESOURCE_VISIBILITY.private);
        });

        it("should propagate visibility internal", () => {
            linkedModel = cds.linked(`
                entity AppCustomers {
                    key ID         : String;
                    addresses      : Composition of many Addresses on addresses.customer = $self;
                }

                @ODM.entityName: 'CompositionOdmEntity'
                entity Addresses {
                    customer       : Association to AppCustomers;
                }

                service MyService {
                    entity Customers as projection on AppCustomers;
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                }
                annotate MyService with @ORD.Extensions : {
                    visibility : 'internal',
                };
            `);
            const model = new Configuration(linkedModel).csn;
            const eventDefinition = model.definitions["MyService.ServiceEvent"];
            expect(eventDefinition[ORD_EXTENSIONS_PREFIX + "visibility"]).toEqual(RESOURCE_VISIBILITY.internal);
        });

        it("should not propagate if there is no visibility annotation", () => {
            linkedModel = cds.linked(`
                entity AppCustomers {
                    key ID         : String;
                    addresses      : Composition of many Addresses on addresses.customer = $self;
                }

                @ODM.entityName: 'CompositionOdmEntity'
                entity Addresses {
                    customer       : Association to AppCustomers;
                }

                service MyService {
                    entity Customers as projection on AppCustomers;
                    event ServiceEvent : {
                        ID    : Integer;
                    }
                }
            `);
            const model = new Configuration(linkedModel).csn;
            const eventDefinition = model.definitions["MyService.ServiceEvent"];
            expect(eventDefinition[ORD_EXTENSIONS_PREFIX + "visibility"]).toBeUndefined();
        });
    });
});
