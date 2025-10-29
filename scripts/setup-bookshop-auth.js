#!/usr/bin/env node

/**
 * Setup Authentication Configuration for Bookshop Integration Tests
 * This script generates bcrypt passwords and sets up authentication configuration
 * for the integration pipeline
 */

const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

// Configuration
const BOOKSHOP_DIR = path.join(__dirname, "..", "__tests__", "bookshop");
const CDSRC_PATH = path.join(BOOKSHOP_DIR, ".cdsrc.json");
const DEFAULT_PASSWORD = "test-secret-123";
const BCRYPT_ROUNDS = 10;

// Colors for output
const colors = {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    reset: "\x1b[0m",
};

function log(message, color = "green") {
    console.log(`${colors[color]}[INFO]${colors.reset} ${message}`);
}

function warn(message) {
    console.log(`${colors.yellow}[WARN]${colors.reset} ${message}`);
}

function error(message) {
    console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
    process.exit(1);
}

async function generateBcryptHash(password) {
    try {
        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        log(`Generated bcrypt hash for password`);
        return hash;
    } catch (err) {
        error(`Failed to generate bcrypt hash: ${err.message}`);
    }
}

async function setupAuthConfiguration() {
    log("Setting up authentication configuration for bookshop integration tests...");

    // Read environment variables
    const password = process.env.TEST_PASSWORD || DEFAULT_PASSWORD;
    const username = process.env.TEST_USERNAME || "admin";
    const trustedIssuer = process.env.TRUSTED_ISSUER || "C=DE,O=SAP,OU=UCL,CN=UCL Certificate Authority";
    const trustedSubject = process.env.TRUSTED_SUBJECT || "C=DE,O=SAP,OU=UCL,CN=ucl-discovery-bot";

    log(`Using username: ${username}`);
    log(`Using trusted issuer: ${trustedIssuer}`);
    log(`Using trusted subject: ${trustedSubject}`);

    // Generate bcrypt hash
    const passwordHash = await generateBcryptHash(password);

    // Read existing .cdsrc.json
    let cdsrcConfig;
    try {
        const cdsrcContent = fs.readFileSync(CDSRC_PATH, "utf8");
        cdsrcConfig = JSON.parse(cdsrcContent);
        log("Loaded existing .cdsrc.json configuration");
    } catch (err) {
        error(`Failed to read .cdsrc.json: ${err.message}`);
    }

    // Update authentication configuration
    if (!cdsrcConfig.authentication) {
        cdsrcConfig.authentication = {};
    }

    // Set up basic authentication with new nested structure
    if (!cdsrcConfig.authentication.basic) {
        cdsrcConfig.authentication.basic = {};
    }

    cdsrcConfig.authentication.basic.credentials = {
        [username]: passwordHash,
    };

    // Set up mTLS configuration
    if (!cdsrcConfig.authentication.mtls) {
        cdsrcConfig.authentication.mtls = {
            mode: "sap:cmp-mtls",
            trustedIssuers: [],
            trustedSubjects: [],
            decodeBase64Headers: false,
        };
    }

    cdsrcConfig.authentication.mtls.trustedIssuers = [trustedIssuer];
    cdsrcConfig.authentication.mtls.trustedSubjects = [trustedSubject];

    // Ensure authentication types are set
    cdsrcConfig.authentication.types = ["mtls", "basic"];

    // Write updated configuration
    try {
        fs.writeFileSync(CDSRC_PATH, JSON.stringify(cdsrcConfig, null, 4) + "\n");
        log("Updated .cdsrc.json with authentication configuration");
    } catch (err) {
        error(`Failed to write .cdsrc.json: ${err.message}`);
    }

    // Create environment variables file for CI/CD
    const envContent = [
        `# Authentication configuration for bookshop integration tests`,
        `# Generated on ${new Date().toISOString()}`,
        ``,
        `# Basic Authentication`,
        `ORD_AUTH_TYPE=["mtls","basic"]`,
        `BASIC_AUTH={"${username}":"${passwordHash}"}`,
        ``,
        `# Test credentials for verification`,
        `TEST_USERNAME=${username}`,
        `TEST_PASSWORD=${password}`,
        ``,
        `# mTLS Configuration`,
        `TRUSTED_ISSUER=${trustedIssuer}`,
        `TRUSTED_SUBJECT=${trustedSubject}`,
        ``,
    ].join("\n");

    const envPath = path.join(__dirname, "..", "auth-env.txt");
    try {
        fs.writeFileSync(envPath, envContent);
        log("Created auth-env.txt with environment variables");
    } catch (err) {
        error(`Failed to write auth-env.txt: ${err.message}`);
    }

    // Create test configuration for debugging
    const testConfig = {
        authentication: {
            username: username,
            password: password,
            passwordHash: passwordHash,
            trustedIssuer: trustedIssuer,
            trustedSubject: trustedSubject,
        },
        endpoints: {
            wellKnown: "/.well-known/open-resource-discovery",
            ordDocument: "/ord/v1/documents/ord-document",
        },
        headers: {
            basic: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
            mtls: {
                "x-ssl-client-verify": "0",
                "x-ssl-client-subject-dn": trustedSubject,
                "x-ssl-client-subject-cn": "ucl-discovery-bot",
                "x-ssl-client-issuer-dn": trustedIssuer,
                "user-agent": "UCL-Discovery-Bot/1.0",
                "x-ucl-bot-version": "1.0.0",
            },
        },
    };

    const testConfigPath = path.join(__dirname, "..", "test-config.json");
    try {
        fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2) + "\n");
        log("Created test-config.json for debugging");
    } catch (err) {
        warn(`Could not write test-config.json: ${err.message}`);
    }

    log("Authentication configuration setup completed successfully!");
    console.log("\nConfiguration Summary:");
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    console.log(`  Password Hash: ${passwordHash}`);
    console.log(`  Trusted Issuer: ${trustedIssuer}`);
    console.log(`  Trusted Subject: ${trustedSubject}`);
    console.log("\nFiles created/updated:");
    console.log(`  - ${CDSRC_PATH}`);
    console.log(`  - ${envPath}`);
    console.log(`  - ${testConfigPath}`);
}

// Main execution
if (require.main === module) {
    setupAuthConfiguration().catch((err) => {
        error(`Setup failed: ${err.message}`);
    });
}

module.exports = {
    setupAuthConfiguration,
    generateBcryptHash,
};
