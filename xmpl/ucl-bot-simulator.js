const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

class UCLDiscoveryBot {
  constructor() {
    this.botCertPath = './ucl-certs/ucl-bot-cert.pem';
    this.botName = 'UCL Discovery Bot';
    this.baseURL = 'http://localhost:4004';
  }

  generateSAPCFHeaders() {
    try {
      const certPem = fs.readFileSync(this.botCertPath, 'utf8');
      const x509 = new crypto.X509Certificate(certPem);
      
      const subjectDn = x509.subject.replace(/\n/g, ',').replace(/\s+/g, ' ').trim();
      const issuerDn = x509.issuer.replace(/\n/g, ',').replace(/\s+/g, ' ').trim();
      
      return {
        'x-ssl-client-verify': '0',
        'x-ssl-client-subject-dn': subjectDn,
        'x-ssl-client-subject-cn': 'ucl-discovery-bot',
        'x-ssl-client-issuer-dn': issuerDn,
        'x-ssl-client-notbefore': x509.validFrom,
        'x-ssl-client-notafter': x509.validTo,
        'user-agent': 'UCL-Discovery-Bot/1.0',
        'x-ucl-bot-version': '1.0.0'
      };
    } catch (error) {
      throw new Error(`Failed to load UCL bot certificate: ${error.message}`);
    }
  }

  async discoverORDDocument() {
    console.log(`🤖 ${this.botName} starting ORD discovery...`);
    
    try {
      const headers = this.generateSAPCFHeaders();
      
      console.log('📋 Certificate Information:');
      console.log(`   Subject: ${headers['x-ssl-client-subject-dn']}`);
      console.log(`   Issuer: ${headers['x-ssl-client-issuer-dn']}`);
      console.log(`   Valid Until: ${headers['x-ssl-client-notafter']}`);
      
      console.log('\n📋 All Headers Being Sent:');
      Object.keys(headers).forEach(key => {
        console.log(`   ${key}: ${headers[key]}`);
      });
      
      console.log('\n🔍 Discovering ORD endpoints...');
      const wellKnownResponse = await axios.get(
        `${this.baseURL}/.well-known/open-resource-discovery`,
        { headers }
      );
      
      console.log('✅ Well-known endpoint accessible');
      console.log('📄 Available ORD documents:', JSON.stringify(wellKnownResponse.data, null, 2));
      
      console.log('\n📊 Fetching ORD document...');
      const ordResponse = await axios.get(
        `${this.baseURL}/ord/v1/documents/ord-document`,
        { headers }
      );
      
      console.log('✅ ORD document retrieved successfully');
      console.log(`📈 Document contains:`);
      console.log(`   - Packages: ${ordResponse.data.packages?.length || 0}`);
      console.log(`   - Products: ${ordResponse.data.products?.length || 0}`);
      console.log(`   - API Resources: ${ordResponse.data.apiResources?.length || 0}`);
      console.log(`   - Event Resources: ${ordResponse.data.eventResources?.length || 0}`);
      
      console.log('\n🔬 Validating ORD document structure...');
      this.validateORDDocument(ordResponse.data);
      
      return ordResponse.data;
      
    } catch (error) {
      console.error(`❌ UCL Bot Error: ${error.response?.status} - ${error.response?.data || error.message}`);
      throw error;
    }
  }

  validateORDDocument(ordDoc) {
    const requiredFields = ['openResourceDiscovery', 'products', 'packages'];
    const missingFields = requiredFields.filter(field => !ordDoc[field]);
    
    if (missingFields.length > 0) {
      console.log(`⚠️  Missing required fields: ${missingFields.join(', ')}`);
    } else {
      console.log('✅ ORD document structure is valid');
    }
    
    if (ordDoc.openResourceDiscovery) {
      console.log(`📋 ORD Specification Version: ${ordDoc.openResourceDiscovery}`);
    }
  }

  async testUnauthorizedAccess() {
    console.log('\n🚫 Testing unauthorized access (without certificate)...');
    
    try {
      await axios.get(`${this.baseURL}/.well-known/open-resource-discovery`);
      console.log('❌ ERROR: Unauthorized access should have been blocked!');
    } catch (error) {
      console.log(`✅ Correctly blocked unauthorized access: ${error.response?.status}`);
    }
  }
}

async function runUCLBotSimulation() {
  const bot = new UCLDiscoveryBot();
  
  try {
    await bot.discoverORDDocument();
    await bot.testUnauthorizedAccess();
    console.log('\n🎉 UCL Bot simulation completed successfully!');
  } catch (error) {
    console.error('\n💥 UCL Bot simulation failed:', error.message);
  }
}

if (require.main === module) {
  runUCLBotSimulation();
}

module.exports = { UCLDiscoveryBot };
