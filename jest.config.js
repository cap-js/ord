const config = {
    testTimeout: 4000,
    // Keep broad match, rely on ignore list for integration segregation
    testMatch: ["**/*.test.js"],
    testPathIgnorePatterns: [
        "/node_modules/",
        "/__tests__/integration/", // Ignore new integration folder
        "/__tests__/integration-test-app/", // Ignore embedded test app code
    ],
    // Provide optional flag to re-include integration via CLI: npx jest --testPathPattern=__tests__/integration
    silent: true,
};

module.exports = config;
