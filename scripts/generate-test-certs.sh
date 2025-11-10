#!/bin/bash

# Generate Test Certificates for mTLS Integration Pipeline
# This script creates CA and client certificates for testing mTLS authentication

set -e

# Configuration
CERTS_DIR="${CERTS_DIR:-./test-certs}"
CA_NAME="UCL Certificate Authority"
CLIENT_NAME="ucl-discovery-bot"
VALIDITY_DAYS=365

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if OpenSSL is available
if ! command -v openssl &> /dev/null; then
    error "OpenSSL is required but not installed"
fi

# Create certificates directory
log "Creating certificates directory: $CERTS_DIR"
mkdir -p "$CERTS_DIR"
cd "$CERTS_DIR"

# Generate CA private key
log "Generating CA private key..."
openssl genrsa -out ucl-ca-key.pem 4096

# Generate CA certificate
log "Generating CA certificate..."
openssl req -new -x509 -key ucl-ca-key.pem -out ucl-ca-cert.pem -days $VALIDITY_DAYS -subj "/C=DE/O=SAP/OU=UCL/CN=$CA_NAME"

# Generate client private key
log "Generating client private key..."
openssl genrsa -out ucl-bot-key.pem 4096

# Generate client certificate signing request
log "Generating client certificate signing request..."
openssl req -new -key ucl-bot-key.pem -out ucl-bot.csr -subj "/C=DE/O=SAP/OU=UCL/CN=$CLIENT_NAME"

# Generate client certificate signed by CA
log "Generating client certificate signed by CA..."
openssl x509 -req -in ucl-bot.csr -CA ucl-ca-cert.pem -CAkey ucl-ca-key.pem -CAcreateserial -out ucl-bot-cert.pem -days $VALIDITY_DAYS

# Clean up CSR file
rm ucl-bot.csr

# Set appropriate permissions
chmod 600 *.pem
chmod 644 ucl-ca-cert.pem ucl-bot-cert.pem

# Verify certificates
log "Verifying certificates..."
if openssl verify -CAfile ucl-ca-cert.pem ucl-bot-cert.pem > /dev/null 2>&1; then
    log "Certificate verification successful"
else
    error "Certificate verification failed"
fi

# Display certificate information
log "Certificate generation completed successfully!"
echo
echo "Generated files:"
echo "  - ucl-ca-cert.pem    (CA Certificate)"
echo "  - ucl-ca-key.pem     (CA Private Key)"
echo "  - ucl-bot-cert.pem   (Client Certificate)"
echo "  - ucl-bot-key.pem    (Client Private Key)"
echo
echo "Certificate details:"
echo "CA Certificate:"
openssl x509 -in ucl-ca-cert.pem -noout -subject -issuer -dates
echo
echo "Client Certificate:"
openssl x509 -in ucl-bot-cert.pem -noout -subject -issuer -dates

# Export certificate information for environment variables
log "Exporting certificate information for CI/CD..."
CA_CERT_BASE64=$(base64 -w 0 ucl-ca-cert.pem)
CLIENT_CERT_BASE64=$(base64 -w 0 ucl-bot-cert.pem)
CLIENT_KEY_BASE64=$(base64 -w 0 ucl-bot-key.pem)

# Create environment file for GitHub Actions
cat > ../cert-env.txt << EOF
CA_CERT_BASE64=$CA_CERT_BASE64
CLIENT_CERT_BASE64=$CLIENT_CERT_BASE64
CLIENT_KEY_BASE64=$CLIENT_KEY_BASE64
TRUSTED_ISSUER=C=DE,O=SAP,OU=UCL,CN=$CA_NAME
TRUSTED_SUBJECT=C=DE,O=SAP,OU=UCL,CN=$CLIENT_NAME
EOF

log "Certificate environment variables exported to cert-env.txt"

# Create test headers for debugging
cat > ../test-headers.json << EOF
{
  "x-ssl-client-verify": "0",
  "x-ssl-client-subject-dn": "C=DE,O=SAP,OU=UCL,CN=$CLIENT_NAME",
  "x-ssl-client-subject-cn": "$CLIENT_NAME",
  "x-ssl-client-issuer-dn": "C=DE,O=SAP,OU=UCL,CN=$CA_NAME",
  "x-ssl-client-notbefore": "$(openssl x509 -in ucl-bot-cert.pem -noout -startdate | cut -d= -f2)",
  "x-ssl-client-notafter": "$(openssl x509 -in ucl-bot-cert.pem -noout -enddate | cut -d= -f2)",
  "user-agent": "UCL-Discovery-Bot/1.0",
  "x-ucl-bot-version": "1.0.0"
}
EOF

log "Test headers created in test-headers.json"
log "Certificate generation completed successfully!"
