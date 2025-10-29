const { authenticate } = require('../lib/authentication.js');

console.log('=== Debug mTLS Middleware ===');

// Create a mock request object with the same headers as the bot
const mockReq = {
  headers: {
    'x-ssl-client-verify': '0',
    'x-ssl-client-subject-dn': 'C=DE,O=SAP,OU=UCL,CN=ucl-discovery-bot',
    'x-ssl-client-subject-cn': 'ucl-discovery-bot',
    'x-ssl-client-issuer-dn': 'C=DE,O=SAP,OU=UCL,CN=UCL Certificate Authority',
    'x-ssl-client-notbefore': 'Oct 29 09:39:42 2025 GMT',
    'x-ssl-client-notafter': 'Oct 29 09:39:42 2026 GMT',
    'user-agent': 'UCL-Discovery-Bot/1.0',
    'x-ucl-bot-version': '1.0.0'
  }
};

const mockRes = {
  status: function(code) {
    console.log(`Response status: ${code}`);
    return this;
  },
  send: function(message) {
    console.log(`Response message: ${message}`);
    return this;
  },
  setHeader: function(name, value) {
    console.log(`Response header: ${name} = ${value}`);
    return this;
  }
};

const mockNext = function() {
  console.log('Authentication passed - next() called');
};

console.log('Mock request headers:', JSON.stringify(mockReq.headers, null, 2));

console.log('\n=== Testing Authentication Middleware ===');
authenticate(mockReq, mockRes, mockNext)
  .then(() => {
    console.log('Authentication middleware completed');
  })
  .catch(error => {
    console.error('Authentication middleware error:', error.message);
  });
