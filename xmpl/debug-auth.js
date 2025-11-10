const { createAuthConfig, getAuthConfig } = require('../lib/authentication.js');
const cds = require('@sap/cds');

console.log('=== Debug Authentication Configuration ===');
console.log('Current working directory:', process.cwd());
console.log('CDS environment:', JSON.stringify(cds.env, null, 2));

console.log('\n=== Creating Auth Config ===');
const authConfig = createAuthConfig();
console.log('Auth Config:', JSON.stringify(authConfig, null, 2));

console.log('\n=== Getting Auth Config (with context) ===');
try {
    const contextAuthConfig = getAuthConfig();
    console.log('Context Auth Config:', JSON.stringify(contextAuthConfig, null, 2));
} catch (error) {
    console.error('Error getting auth config:', error.message);
}
