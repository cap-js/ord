const path = require('path');

// Since configProvider reads actual files, we'll test against the real files
describe('configProvider', () => {
    const configProvider = require('../../../../lib/dataProducts/config/configProvider');

    describe('getTransformerAnnotationConfig', () => {
        it('should read and return transformer config', () => {
            const result = configProvider.getTransformerAnnotationConfig();
            
            expect(result).toBeDefined();
            expect(result).toHaveProperty('allowlistMode');
            expect(result).toHaveProperty('allowlist');
            expect(result.allowlistMode).toBe('dynamic');
            expect(result.allowlist).toEqual(['*']);
        });
    });

    describe('getShareAnnotationConfig', () => {
        it('should read and return share config', () => {
            const result = configProvider.getShareAnnotationConfig();
            
            expect(result).toBeDefined();
            expect(result).toHaveProperty('allowlistMode');
            expect(result).toHaveProperty('allowlist');
            expect(result.allowlistMode).toBe('dynamic');
            expect(result.allowlist).toEqual(['*']);
        });
    });

    describe('getCsnAnnotationConfig', () => {
        it('should read and return CSN config', () => {
            const result = configProvider.getCsnAnnotationConfig();
            
            expect(result).toBeDefined();
            expect(result).toHaveProperty('allowlistMode');
            expect(result).toHaveProperty('allowlist');
            expect(result.allowlistMode).toBe('dynamic');
            expect(result.allowlist).toEqual(['*']);
        });
    });

    describe('getDpdAnnotationConfig', () => {
        it('should read and return DPD config', () => {
            const result = configProvider.getDpdAnnotationConfig();
            
            expect(result).toBeDefined();
            expect(result).toHaveProperty('allowlistMode');
            expect(result).toHaveProperty('allowlist');
            expect(result.allowlistMode).toBe('dynamic');
            expect(result.allowlist).toEqual(['*']);
        });
    });

    describe('all configs should have expected structure', () => {
        it('should have alias and normalizers defined where appropriate', () => {
            const transformer = configProvider.getTransformerAnnotationConfig();
            const share = configProvider.getShareAnnotationConfig();
            const csn = configProvider.getCsnAnnotationConfig();
            const dpd = configProvider.getDpdAnnotationConfig();
            
            // Check transformer has expected properties
            expect(transformer).toHaveProperty('alias');
            expect(transformer).toHaveProperty('normalizers');
            expect(transformer).toHaveProperty('allowedPrefixes');
            
            // Check share has expected properties
            expect(share).toHaveProperty('alias');
            expect(share).toHaveProperty('normalizers');
            
            // Check csn has expected properties
            expect(csn).toHaveProperty('alias');
            expect(csn).toHaveProperty('normalizers');
            
            // Check dpd has expected properties (simpler structure)
            expect(dpd).toHaveProperty('allowlist');
        });
    });

    describe('config content validation', () => {
        it('transformer config should have spark prefix', () => {
            const config = configProvider.getTransformerAnnotationConfig();
            expect(config.allowedPrefixes).toContain('spark.');
        });

        it('share config should have schema URLs', () => {
            const config = configProvider.getShareAnnotationConfig();
            expect(config).toHaveProperty('schemaUrl');
            expect(config).toHaveProperty('schemaLocalFile');
        });

        it('configs should use dynamic allowlist mode', () => {
            const configs = [
                configProvider.getTransformerAnnotationConfig(),
                configProvider.getShareAnnotationConfig(),
                configProvider.getCsnAnnotationConfig(),
                configProvider.getDpdAnnotationConfig()
            ];
            
            configs.forEach(config => {
                expect(config.allowlistMode).toBe('dynamic');
            });
        });
    });
});