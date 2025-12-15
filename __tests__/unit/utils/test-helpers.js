const { ORD_ACCESS_STRATEGY, AUTHENTICATION_TYPE } = require("../../../lib/constants");

/**
 * Create standard open authentication configuration object
 * @returns {Object} Open authentication configuration
 */
function createOpenAuthConfig() {
    return {
        accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
        hasBasic: false,
        hasCfMtls: false,
    };
}

/**
 * Create basic authentication configuration object
 * @returns {Object} Basic authentication configuration
 */
function createBasicAuthConfig() {
    return {
        accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Basic }],
        hasBasic: true,
        hasCfMtls: false,
    };
}

/**
 * Create CF mTLS authentication configuration object
 * @returns {Object} CF mTLS authentication configuration
 */
function createCfMtlsAuthConfig() {
    return {
        accessStrategies: [{ type: ORD_ACCESS_STRATEGY.CfMtls }],
        hasBasic: false,
        hasCfMtls: true,
    };
}

/**
 * Create mixed authentication configuration object
 * @returns {Object} Mixed authentication configuration
 */
function createMixedAuthConfig() {
    return {
        accessStrategies: [
            { type: ORD_ACCESS_STRATEGY.Basic },
            { type: ORD_ACCESS_STRATEGY.CfMtls }
        ],
        hasBasic: true,
        hasCfMtls: true,
    };
}

/**
 * Mock CDS context authentication configuration
 * @param {Object} cds - CDS object to mock
 * @param {Object} authConfig - Authentication configuration (defaults to open)
 * @returns {Object} Jest spy object
 */
function mockCdsContext(cds, authConfig = createOpenAuthConfig()) {
    return jest.spyOn(cds, "context", "get").mockReturnValue({
        authConfig,
    });
}

/**
 * Mock authentication service configuration
 * @param {Object} authentication - Authentication module to mock
 * @param {Object} authConfig - Authentication configuration (defaults to open)
 * @returns {Object} Object containing both spy objects
 */
function mockAuthenticationService(authentication, authConfig = createOpenAuthConfig()) {
    const getAuthConfigSpy = jest.spyOn(authentication, "getAuthConfig").mockResolvedValue(authConfig);
    const getAuthConfigSyncSpy = jest.spyOn(authentication, "getAuthConfigSync").mockReturnValue(authConfig);
    
    return { getAuthConfigSpy, getAuthConfigSyncSpy };
}

/**
 * Mock createAuthConfig function (used in some tests)
 * @param {Object} authentication - Authentication module to mock
 * @param {Object} authConfig - Authentication configuration (defaults to open)
 * @returns {Object} Jest spy object
 */
function mockCreateAuthConfig(authentication, authConfig = createOpenAuthConfig()) {
    return jest.spyOn(authentication, "createAuthConfig").mockResolvedValue(authConfig);
}

/**
 * Setup complete authentication mocks for a test
 * @param {Object} cds - CDS object to mock
 * @param {Object} authentication - Authentication module to mock
 * @param {Object} authConfig - Authentication configuration (defaults to open)
 * @returns {Object} Object containing all spy objects
 */
function setupAuthMocks(cds, authentication, authConfig = createOpenAuthConfig()) {
    const cdsContextSpy = mockCdsContext(cds, authConfig);
    const { getAuthConfigSpy, getAuthConfigSyncSpy } = mockAuthenticationService(authentication, authConfig);
    
    return {
        cdsContextSpy,
        getAuthConfigSpy,
        getAuthConfigSyncSpy,
    };
}

module.exports = {
    // Configuration creators
    createOpenAuthConfig,
    createBasicAuthConfig,
    createCfMtlsAuthConfig,
    createMixedAuthConfig,
    
    // Mock functions
    mockCdsContext,
    mockAuthenticationService,
    mockCreateAuthConfig,
    setupAuthMocks,
};
