const config = {
    collectCoverageFrom: [
        "lib/**/*.js",
        "!**/node_modules/**",
        "!**/__tests__/**",
        "!**/coverage/**"
    ],
    projects: [
        {
            displayName: "unit",
            testMatch: ["<rootDir>/__tests__/unittest/**/*.test.js", "<rootDir>/__tests__/*.test.js"],
            testPathIgnorePatterns: ["<rootDir>/__tests__/integration/"],
            testTimeout: 4000,
            silent: true
        },
        {
            displayName: "integration", 
            testMatch: ["<rootDir>/__tests__/integration/**/*.test.js"],
            testTimeout: 15000,
            silent: true
        }
    ]
};

module.exports = config;
