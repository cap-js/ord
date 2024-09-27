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
        it('should return default value if policyLevel contains sap', () => {
            const testPolicyLevel = 'sap:policy';

            expect(defaults.packages(testGetPackageDataName, testPolicyLevel, testGetPackageOrdNamespace)).toMatchSnapshot();
        });

        it('should return default value if policyLevel does not contain sap', () => {
            const testPolicyLevel = 'policy';

            expect(defaults.packages(testGetPackageDataName, testPolicyLevel, testGetPackageOrdNamespace)).toMatchSnapshot();
        });
    });

    describe('consumptionBundles', () => {
        const testConsumptionBundlesName = 'My Consumption Bundle';
        it('should return default value', () => {
            expect(defaults.consumptionBundles(testConsumptionBundlesName)).toMatchSnapshot();
        });
    });
    describe('baseTemplate', () => {
        it('should return default value', () => {
            expect(defaults.baseTemplate).toMatchSnapshot();
        });
    });
});
