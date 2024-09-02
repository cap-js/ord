const defaults = require('../../lib/defaults');

describe('defaults', () => {
    describe('$schema', () => {
        const test$schemaDefaultValue = 'https://sap.github.io/open-resource-discovery/spec-v1/interfaces/Document.schema.json'; 
        it('should return default value', () => {
            expect(defaults.$schema).toEqual(test$schemaDefaultValue);
        });
    });

    describe('openResourceDiscovery', () => {
        const testOpenResourceDiscoveryDefaultValue = '1.9';
        it('should return default value', () => {
            expect(defaults.openResourceDiscovery).toEqual(testOpenResourceDiscoveryDefaultValue);
        });
    });

    describe('policyLevel', () => {
        const testPolicyLevelDefaultValue = 'none';
        it('should return default value', () => {
            expect(defaults.policyLevel).toEqual(testPolicyLevelDefaultValue);
        });
    });

    describe('description', () => {
        const testDescriptionDefaultValue = 'this is an application description';
        it('should return default value', () => {
            expect(defaults.description).toEqual(testDescriptionDefaultValue);
        });
    });

    describe('products', () => {
        const testProductsName = 'My Product';
        it('should return default value', () => {
            expect(defaults.products(testProductsName)).toEqual([
                {
                    ordId: 'customer:product:My.Product:',
                    title: 'My Product',
                    shortDescription: 'Description for My Product',
                    vendor: 'customer:vendor:customer:'
                }
            ]);
        });
    });

    describe('groupTypeId', () => {
        const testGroupTypeIdDefaultValue = 'sap.cds:service';
        it('should return default value', () => {
            expect(defaults.groupTypeId).toEqual(testGroupTypeIdDefaultValue);
        });
    });

    describe('packages', () => {
        const testGetPackageDataName = 'My Package';
        const testGetPackageCapNamespace = 'sample';
        it('should return default value if policyLevel contains sap', () => {
            const testPolicyLevel = 'sap:policy';
            const testCreatePackage = (_, tag) => {
                return {
                    ordId: `MyPackage:package:${testGetPackageCapNamespace}${tag}`,
                    title: `My Package`,
                    shortDescription: 'Short description for My Package',
                    description: 'Description for My Package',
                    version: '1.0.0',
                    partOfProducts: [`customer:product:My.Package:`],
                    vendor: 'customer:vendor:Customer:'
                };
            };
            const testCreatePackageReturnValue = [testCreatePackage(testGetPackageDataName, '-api:v1'), testCreatePackage(testGetPackageDataName, '-event:v1')];

            expect(defaults.packages(testGetPackageDataName, testPolicyLevel, testGetPackageCapNamespace)).toEqual(testCreatePackageReturnValue);
        });

        it('should return default value if policyLevel does not contain sap', () => {
            const testPolicyLevel = 'policy';
            const testCreatePackage = (_, tag) => {
                return {
                    ordId: `MyPackage:package:${testGetPackageCapNamespace}${tag}`,
                    title: `My Package`,
                    shortDescription: 'Short description for My Package',
                    description: 'Description for My Package',
                    version: '1.0.0',
                    partOfProducts: [`customer:product:My.Package:`],
                    vendor: 'customer:vendor:Customer:'
                };
            };
            const testCreatePackageReturnValue = [testCreatePackage(testGetPackageDataName, ':v1')];

            expect(defaults.packages(testGetPackageDataName, testPolicyLevel, testGetPackageCapNamespace)).toEqual(testCreatePackageReturnValue);
        });
    });

    describe('consumptionBundles', () => {
        const testConsumptionBundlesName = 'My Consumption Bundle';
        it('should return default value', () => {
            expect(defaults.consumptionBundles(testConsumptionBundlesName)).toEqual([
                {
                    ordId: 'MyConsumptionBundle:consumptionBundle:unknown:v1',
                    version: '1.0.0',
                    title: 'Unprotected resources',
                    shortDescription:
                      'If we have another protected API then it will be another object',
                    description:
                      'This Consumption Bundle contains all resources of the reference app which are unprotected and do not require authentication',
                }
            ]);
        });
    });

    describe('apiResources', () => {
        it('should return default value', () => {
            expect(defaults.apiResources).toEqual([]);
        });
    });

    describe('eventResources', () => {
        it('should return default value', () => {
            expect(defaults.eventResources).toEqual([]);
        });
    });

    describe('entityTypes', () => {
        it('should return default value', () => {
            expect(defaults.entityTypes).toEqual([]);
        });
    });

    describe('baseTemplate', () => {
        const testBaseTemplateDefaultValue = {
            openResourceDiscoveryV1: {
                documents: [
                    {
                        url: '/open-resource-discovery/v1/documents/1',
                        accessStrategies: [
                            {
                                type: 'open',
                            },
                        ],
                    },
                ],
            },
        };
        it('should return default value', () => {
            expect(defaults.baseTemplate).toEqual(testBaseTemplateDefaultValue);
        });
    });
});
