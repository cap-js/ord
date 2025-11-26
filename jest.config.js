const config = {
    testTimeout: 4000,
    testMatch: ["**/*.test.js"],
    testPathIgnorePatterns: [
        "/node_modules/",
        "/__tests__/integration/", // Exclude all integration tests from default runs
    ],
    silent: true,
};

module.exports = config;
