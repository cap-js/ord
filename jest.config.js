const config = {
    testTimeout: 4000,
    testMatch: ["**/*.test.js"],
    testPathIgnorePatterns: [
        "/node_modules/",
        "__tests__/integration.test.js", // Exclude integration tests from default runs
        "__tests__/integration-mtls.test.js", // Exclude mTLS integration tests from default runs
    ],
    silent: true,
};

module.exports = config;
