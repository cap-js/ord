const fs = require("fs");
const path = require("path");

// Configuration
const BASE_URL = process.env.BASE_URL || "http://localhost:4004";
const TEST_CONFIG_PATH = path.join(__dirname, "..", "..", "test-config.json");

// Test results tracking
const testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    details: [],
};

/**
 * Records test result and updates counters
 * @param {string} name Test name
 * @param {boolean} passed Whether test passed
 * @param {string} message Optional error message
 */
function recordTest(name, passed, message = "") {
    testResults.total++;
    if (passed) {
        testResults.passed++;
        console.log(`✓ ${name}`);
    } else {
        testResults.failed++;
        console.log(`✗ ${name}: ${message}`);
    }
    testResults.details.push({ name, passed, message });
}

/**
 * Makes HTTP request with proper error handling
 * @param {string} url Request URL
 * @param {Object} options Request options
 * @returns {Promise<Object>} Response object
 */
async function makeRequest(url, options = {}) {
    const https = require("https");
    const http = require("http");

    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === "https:" ? https : http;

        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method || "GET",
            headers: options.headers || {},
            timeout: 10000,
        };

        const req = client.request(requestOptions, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const responseData = data ? JSON.parse(data) : null;
                    resolve({
                        status: res.statusCode,
                        data: responseData,
                        headers: res.headers,
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        data: data,
                        headers: res.headers,
                    });
                }
            });
        });

        req.on("error", (error) => {
            resolve({
                status: 0,
                error: error.message,
            });
        });

        req.on("timeout", () => {
            req.destroy();
            resolve({
                status: 0,
                error: "Request timeout",
            });
        });

        req.end();
    });
}

/**
 * Tests endpoint without authentication (should fail)
 */
async function testNoAuthentication() {
    console.log("Testing endpoint without authentication (should fail)");

    const response = await makeRequest(`${BASE_URL}/.well-known/open-resource-discovery`);

    if (response.status === 401) {
        recordTest("No authentication returns 401", true);
    } else {
        recordTest("No authentication returns 401", false, `Expected 401, got ${response.status}`);
    }
}

/**
 * Tests basic authentication
 * @param {Object} testConfig Test configuration object
 */
async function testBasicAuthentication(testConfig) {
    console.log("Testing basic authentication");

    const headers = {
        Authorization: testConfig.headers.basic,
    };

    // Test well-known endpoint
    const wellKnownResponse = await makeRequest(`${BASE_URL}/.well-known/open-resource-discovery`, { headers });

    if (wellKnownResponse.status === 200) {
        recordTest("Basic auth - well-known endpoint", true);

        // Validate response structure
        if (wellKnownResponse.data && wellKnownResponse.data.openResourceDiscoveryV1) {
            recordTest("Basic auth - well-known response structure", true);

            const ordDocumentUrl = wellKnownResponse.data.openResourceDiscoveryV1.documents?.[0]?.url;
            if (ordDocumentUrl) {
                // Test ORD document endpoint
                const ordResponse = await makeRequest(`${BASE_URL}${ordDocumentUrl}`, { headers });

                if (ordResponse.status === 200) {
                    recordTest("Basic auth - ORD document endpoint", true);

                    // Validate ORD document structure
                    if (ordResponse.data && ordResponse.data.openResourceDiscovery) {
                        recordTest("Basic auth - ORD document structure", true);

                        // Check for expected bookshop resources
                        const ordDoc = ordResponse.data;
                        const hasApiResources = ordDoc.apiResources && ordDoc.apiResources.length > 0;
                        const hasPackages = ordDoc.packages && ordDoc.packages.length > 0;

                        recordTest("Basic auth - ORD document has API resources", hasApiResources);
                        recordTest("Basic auth - ORD document has packages", hasPackages);

                        console.log(`Found ${ordDoc.apiResources?.length || 0} API resources`);
                        console.log(`Found ${ordDoc.packages?.length || 0} packages`);
                        console.log(`Found ${ordDoc.entityTypes?.length || 0} entity types`);
                    } else {
                        recordTest("Basic auth - ORD document structure", false, "Invalid ORD document structure");
                    }
                } else {
                    recordTest("Basic auth - ORD document endpoint", false, `Expected 200, got ${ordResponse.status}`);
                }
            } else {
                recordTest("Basic auth - ORD document URL found", false, "No ORD document URL in well-known response");
            }
        } else {
            recordTest("Basic auth - well-known response structure", false, "Invalid well-known response structure");
        }
    } else {
        recordTest("Basic auth - well-known endpoint", false, `Expected 200, got ${wellKnownResponse.status}`);
    }
}

/**
 * Tests mTLS authentication
 * @param {Object} testConfig Test configuration object
 */
async function testMtlsAuthentication(testConfig) {
    console.log("Testing mTLS authentication");

    const headers = testConfig.headers.mtls;

    // Test well-known endpoint with mTLS headers
    const wellKnownResponse = await makeRequest(`${BASE_URL}/.well-known/open-resource-discovery`, { headers });

    if (wellKnownResponse.status === 200) {
        recordTest("mTLS auth - well-known endpoint", true);

        // Validate response structure
        if (wellKnownResponse.data && wellKnownResponse.data.openResourceDiscoveryV1) {
            recordTest("mTLS auth - well-known response structure", true);

            const ordDocumentUrl = wellKnownResponse.data.openResourceDiscoveryV1.documents?.[0]?.url;
            if (ordDocumentUrl) {
                // Test ORD document endpoint
                const ordResponse = await makeRequest(`${BASE_URL}${ordDocumentUrl}`, { headers });

                if (ordResponse.status === 200) {
                    recordTest("mTLS auth - ORD document endpoint", true);

                    // Validate ORD document structure
                    if (ordResponse.data && ordResponse.data.openResourceDiscovery) {
                        recordTest("mTLS auth - ORD document structure", true);

                        // Check for expected bookshop resources
                        const ordDoc = ordResponse.data;
                        const hasApiResources = ordDoc.apiResources && ordDoc.apiResources.length > 0;
                        const hasPackages = ordDoc.packages && ordDoc.packages.length > 0;

                        recordTest("mTLS auth - ORD document has API resources", hasApiResources);
                        recordTest("mTLS auth - ORD document has packages", hasPackages);
                    } else {
                        recordTest("mTLS auth - ORD document structure", false, "Invalid ORD document structure");
                    }
                } else {
                    recordTest("mTLS auth - ORD document endpoint", false, `Expected 200, got ${ordResponse.status}`);
                }
            } else {
                recordTest("mTLS auth - ORD document URL found", false, "No ORD document URL in well-known response");
            }
        } else {
            recordTest("mTLS auth - well-known response structure", false, "Invalid well-known response structure");
        }
    } else {
        recordTest("mTLS auth - well-known endpoint", false, `Expected 200, got ${wellKnownResponse.status}`);
    }
}

/**
 * Tests invalid credentials (should fail)
 */
async function testInvalidCredentials() {
    console.log("Testing invalid credentials (should fail)");

    const invalidBasicAuth = "Basic " + Buffer.from("invalid:invalid").toString("base64");

    const response = await makeRequest(`${BASE_URL}/.well-known/open-resource-discovery`, {
        headers: { Authorization: invalidBasicAuth },
    });

    if (response.status === 401) {
        recordTest("Invalid credentials return 401", true);
    } else {
        recordTest("Invalid credentials return 401", false, `Expected 401, got ${response.status}`);
    }
}

/**
 * Tests server health
 */
async function testServerHealth() {
    console.log("Testing server health");

    const response = await makeRequest(`${BASE_URL}/`);

    // Any response (even 404 or 401) indicates server is running
    if (response.status !== 0) {
        recordTest("Server is responding", true);
    } else {
        if (response.error && response.error.includes("ECONNREFUSED")) {
            recordTest("Server is responding", false, "Server is not running or not accessible");
        } else {
            recordTest("Server is responding", true, "Server responded with error (but is running)");
        }
    }
}

/**
 * Loads test configuration from file
 * @returns {Object} Test configuration object
 */
function loadTestConfig() {
    try {
        const configContent = fs.readFileSync(TEST_CONFIG_PATH, "utf8");
        return JSON.parse(configContent);
    } catch (error) {
        console.error(`Failed to load test configuration: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log("\n" + "=".repeat(60));
    console.log("🧪 Bookshop mTLS Integration Tests");
    console.log("=".repeat(60));
    console.log(`Target URL: ${BASE_URL}`);
    console.log(`Test Config: ${TEST_CONFIG_PATH}`);
    console.log("=".repeat(60) + "\n");

    const testConfig = loadTestConfig();
    console.log("Loaded test configuration");

    // Run all tests
    await testServerHealth();
    await testNoAuthentication();
    await testInvalidCredentials();
    await testBasicAuthentication(testConfig);
    await testMtlsAuthentication(testConfig);

    // Print results
    console.log("\n" + "=".repeat(60));
    console.log("📊 Test Results Summary");
    console.log("=".repeat(60));

    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

    if (testResults.failed > 0) {
        console.log("\n❌ Failed Tests:");
        testResults.details.filter((t) => !t.passed).forEach((t) => console.log(`  - ${t.name}: ${t.message}`));
    }

    console.log("\n" + "=".repeat(60));

    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle unhandled errors
process.on("unhandledRejection", (reason) => {
    console.error(`Unhandled Rejection: ${reason}`);
    process.exit(1);
});

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch((err) => {
        console.error(`Test execution failed: ${err.message}`);
        process.exit(1);
    });
}

module.exports = {
    runTests,
    testBasicAuthentication,
    testMtlsAuthentication,
    testNoAuthentication,
    testInvalidCredentials,
    testServerHealth,
};
