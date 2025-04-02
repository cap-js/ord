const cds = require('@sap/cds');
const { AUTHENTICATION_TYPE } = require('../../lib/constants');
jest.spyOn(cds, "context", "get").mockReturnValue({
    authConfig: {
        types: [AUTHENTICATION_TYPE.Open],
        accessStrategies: [{ type: AUTHENTICATION_TYPE.Open }]
    }
});
const defaults = require('../../lib/defaults');

describe('defaults', () => {
    describe('$schema', () => {
        it('should return default value', () => {
            expect(defaults.$schema).toMatchSnapshot();
        });
    });

    describe('openResourceDiscovery', () => {
        it('should return default value', () => {
            expect(defaults.openResourceDiscovery).toMatchSnapshot();
        });
    });

    describe('policyLevel', () => {
        it('should return default value', () => {
            expect(defaults.policyLevel).toMatchSnapshot();
        });
    });

    describe('description', () => {
        it('should return default value', () => {
            expect(defaults.description).toMatchSnapshot();
        });
    });

    describe('products', () => {
        const testProductsName = 'My Product';
        it('should return default value', () => {
            expect(defaults.products(testProductsName)).toMatchSnapshot()
        });
    });

    describe('groupTypeId', () => {
        it('should return default value', () => {
            expect(defaults.groupTypeId).toMatchSnapshot()
        });
    });

    describe('packages', () => {
        const testGetPackageDataName = 'My Package';
        const testGetPackageOrdNamespace = 'customer.sample';
        var appConfig = {};
        it('should return default value if policyLevel contains sap', () => {
            const testPolicyLevel = 'sap:policy';
            appConfig = {
                "appName": testGetPackageDataName,
                "ordNamespace": testGetPackageOrdNamespace
            }
            expect(defaults.packages(appConfig, testPolicyLevel)).toMatchSnapshot();
        });

        it('should return default value if policyLevel does not contain sap', () => {
            const testPolicyLevel = 'policy';
            appConfig = {
                "appName": testGetPackageDataName,
                "ordNamespace": testGetPackageOrdNamespace
            }
            expect(defaults.packages(appConfig, testPolicyLevel)).toMatchSnapshot();
        });

        it('should return custom value if user defined in .cdsrc.json', () => {
            const testPolicyLevel = 'policy';
            appConfig = {
                "appName": testGetPackageDataName,
                "ordNamespace": testGetPackageOrdNamespace,
                "products": [
                    {
                        "ordId": "sap:product:eb.bm.tests:",
                        "vendor": "sap:vendor:SAP:"
                    }
                ],
                "env": {
                    "packages": [
                        {
                            "vendor": "sap:vendor:Customer:"
                        }
                    ]
                }
            }
            expect(defaults.packages(appConfig, testPolicyLevel)).toMatchSnapshot();
        });

        it('should return custom value if user defined in .cdsrc.json and contains sap', () => {
            const testPolicyLevel = 'sap:policy';
            appConfig = {
                "appName": testGetPackageDataName,
                "ordNamespace": testGetPackageOrdNamespace,
                "products": [
                    {
                        "ordId": "sap:product:eb.bm.tests:",
                        "vendor": "sap:vendor:SAP:"
                    }
                ],
                "env": {
                    "packages": [
                        {
                            "vendor": "sap:vendor:Customer:"
                        }
                    ]
                }
            }
            expect(defaults.packages(appConfig, testPolicyLevel)).toMatchSnapshot();
        });

        it('should return default product ordId value if user did not define ordId in products in .cdsrc.json', () => {
            const testPolicyLevel = 'policy';
            appConfig = {
                "appName": testGetPackageDataName,
                "ordNamespace": testGetPackageOrdNamespace,
                "products": [
                    {
                        "vendor": "sap:vendor:SAP:"
                    }
                ],
                "env": {
                    "packages": [
                        {
                            "vendor": "sap:vendor:Customer:"
                        }
                    ]
                }
            }
            expect(defaults.packages(appConfig, testPolicyLevel)).toMatchSnapshot();
        });

        it('should return default product ordId value if user did not define ordId in products in .cdsrc.json and contains sap', () => {
            const testPolicyLevel = 'sap:policy';
            appConfig = {
                "appName": testGetPackageDataName,
                "ordNamespace": testGetPackageOrdNamespace,
                "products": [
                    {
                        "vendor": "sap:vendor:SAP:"
                    }
                ],
                "env": {
                    "packages": [
                        {
                            "vendor": "sap:vendor:Customer:"
                        }
                    ]
                }
            }
            expect(defaults.packages(appConfig, testPolicyLevel)).toMatchSnapshot();
        });

        it('should return custom value if user did not define packages in .cdsrc.json', () => {
            const testPolicyLevel = 'policy';
            appConfig = {
                "appName": testGetPackageDataName,
                "ordNamespace": testGetPackageOrdNamespace,
                "products": [
                    {
                        "ordId": "sap:product:eb.bm.tests:",
                        "vendor": "sap:vendor:SAP:"
                    }
                ],
                "env": {
                }
            }
            expect(defaults.packages(appConfig, testPolicyLevel)).toMatchSnapshot();
        });
    });

    describe('consumptionBundles', () => {
        const testAppConfig = {
            appName: 'sap.xref',
            lastUpdate: '2024-06-20T14:04:01+01:00',
        }
        it('should return default value', () => {
            expect(defaults.consumptionBundles(testAppConfig)).toMatchSnapshot();
        });
    });
    describe('baseTemplate', () => {
        it('should return default value', () => {
            expect(defaults.baseTemplate).toMatchSnapshot();
        });
    });
});
