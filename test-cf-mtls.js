#!/usr/bin/env node

/**
 * Test script to verify CF mTLS authentication configuration works correctly
 * and generates proper access strategies in ORD documents.
 */

const cds = require("@sap/cds");
const path = require("path");

async function testCfMtlsConfiguration() {
    console.log("🧪 Testing CF mTLS Configuration Fix");
    console.log("=====================================");

    // Set up test environment
    cds.root = path.join(__dirname, "xmpl");
    
    // Configure CF mTLS authentication
    cds.env.ord = {
        namespace: "sap.sm",
        openResourceDiscovery: "1.8",
        description: "This is ORD document for Ariba Application.",
        policyLevel: "sap:core:v1",
        authentication: {
