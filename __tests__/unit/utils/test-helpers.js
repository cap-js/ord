const { ORD_ACCESS_STRATEGY } = require("../../../lib/constants");

/**
 * Create standard open authentication configuration object
 * @returns {Object} Open authentication configuration
 */
function createOpenAuthConfig() {
    return {
        accessStrategies: [{ type: ORD_ACCESS_STRATEGY.Open }],
    };
}

/**
 * Mock authentication service configuration
 * @param {Object} authentication - Authentication module to mock
 * @param {Object} authConfig - Authentication configuration (defaults to open)
 * @returns {Object} Jest spy object for createAuthConfig
 */
function mockAuthenticationService(authentication, authConfig = createOpenAuthConfig()) {
    const createAuthConfigSpy = jest.spyOn(authentication, "createAuthConfig").mockReturnValue(authConfig);
    return { createAuthConfigSpy };
}

/**
 * Mock createAuthConfig function (used in some tests)
 * @param {Object} authentication - Authentication module to mock
 * @param {Object} authConfig - Authentication configuration (defaults to open)
 * @returns {Object} Jest spy object
 */
function mockCreateAuthConfig(authentication, authConfig = createOpenAuthConfig()) {
    return jest.spyOn(authentication, "createAuthConfig").mockReturnValue(authConfig);
}

module.exports = {
    // Configuration creators
    createOpenAuthConfig,

    // Mock functions
    mockAuthenticationService,
    mockCreateAuthConfig,
};
