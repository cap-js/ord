# CF mTLS Dynamic Endpoint Configuration

This document describes how to configure CloudFoundry mTLS authentication with dynamic certificate fetching from configuration endpoints.

## Overview

The CF mTLS authentication supports two ways to configure trusted certificates:

1. **Static Configuration**: Certificates and root CAs defined directly in environment variables or `.cdsrc.json`
2. **Dynamic Configuration**: Certificates fetched from external configuration endpoints (introduced in this implementation)

Both methods can be combined - certificates from endpoints will be merged with static configuration.

## Configuration

### Environment Variable Method (Production)

Use the `CF_MTLS_TRUSTED_CERTS` environment variable with a JSON configuration:

```bash
CF_MTLS_TRUSTED_CERTS='{"certs":[{"issuer":"CN=CA,O=Org,C=DE","subject":"CN=service,O=Org,C=DE"}],"rootCaDn":["CN=Root CA,O=Org,C=DE"],"configEndpoints":["https://config.example.com/mtls-info"]}'
```

### .cdsrc.json Method (Development)

```json
{
  "authentication": {
    "types": ["cf-mtls"]
  },
  "ord": {
    "cfMtls": {
      "certs": [
        {
          "issuer": "CN=ACME PKI CA,OU=ACME Clients,O=ACME Inc,C=US",
          "subject": "CN=my-service,OU=Dev,O=ACME Inc,C=US"
        }
      ],
      "rootCaDn": [
        "CN=ACME Global Root CA,O=ACME Inc,C=US"
      ],
      "configEndpoints": [
        "https://config.example.com/mtls-info"
      ]
    }
  }
}
```

## Configuration Fields

### `certs` (Array, Optional)

Array of trusted certificate pairs (issuer/subject). Each entry must have:
- `issuer`: Certificate issuer Distinguished Name
- `subject`: Certificate subject Distinguished Name

Both issuer and subject must match **as a pair** for authentication to succeed.

### `rootCaDn` (Array, Required)

Array of trusted root CA Distinguished Names. At least one root CA DN must be configured.

**Security Note**: Root CA DNs are ONLY read from static configuration (environment variable or `.cdsrc.json`), never from dynamic endpoints. This is a security-by-design decision to prevent compromised endpoints from modifying the trust chain.

### `configEndpoints` (Array, Optional)

Array of URLs to fetch additional certificate information from. Each endpoint should return JSON in this format:

```json
{
  "certIssuer": "CN=Dynamic CA,O=Org,C=DE",
  "certSubject": "CN=dynamic-service,O=Org,C=DE"
}
```

**Features**:
- Multiple endpoints supported (fetched in parallel)
- Automatic retry and error handling
- Certificates from endpoints are merged with static configuration
- Failed endpoints do not block authentication if static config exists
- Duplicate certificates are automatically removed
- 10-second timeout per endpoint (default)

## Configuration Examples

### Example 1: Static Configuration Only

```json
{
  "ord": {
    "cfMtls": {
      "certs": [
        {
          "issuer": "CN=Static CA,O=MyOrg,C=DE",
          "subject": "CN=my-app,O=MyOrg,C=DE"
        }
      ],
      "rootCaDn": ["CN=MyOrg Root CA,C=DE"]
    }
  }
}
```

### Example 2: Dynamic Configuration Only

```json
{
  "ord": {
    "cfMtls": {
      "certs": [],
      "rootCaDn": ["CN=MyOrg Root CA,C=DE"],
      "configEndpoints": [
        "https://config.myorg.com/mtls-certs"
      ]
    }
  }
}
```

### Example 3: Combined Static + Dynamic

```json
{
  "ord": {
    "cfMtls": {
      "certs": [
        {
          "issuer": "CN=Static CA,O=MyOrg,C=DE",
          "subject": "CN=static-app,O=MyOrg,C=DE"
        }
      ],
      "rootCaDn": ["CN=MyOrg Root CA,C=DE"],
      "configEndpoints": [
        "https://config-primary.myorg.com/mtls-certs",
        "https://config-backup.myorg.com/mtls-certs"
      ]
    }
  }
}
```

### Example 4: Multiple Certificate Pairs

```json
{
  "ord": {
    "cfMtls": {
      "certs": [
        {
          "issuer": "CN=Dev CA,O=MyOrg,C=DE",
          "subject": "CN=dev-service,O=MyOrg,C=DE"
        },
        {
          "issuer": "CN=Test CA,O=MyOrg,C=DE",
          "subject": "CN=test-service,O=MyOrg,C=DE"
        }
      ],
      "rootCaDn": [
        "CN=MyOrg Dev Root CA,C=DE",
        "CN=MyOrg Test Root CA,C=DE"
      ]
    }
  }
}
```

## How It Works

1. **Service Startup**: 
   - Authentication configuration is initialized
   - If `configEndpoints` are configured, certificates are fetched from all endpoints in parallel
   - Fetched certificates are merged with static configuration
   - Duplicate certificates are removed

2. **Request Authentication**:
   - Client certificate information is extracted from HTTP headers:
     - `x-forwarded-client-cert-issuer-dn` (base64 encoded)
     - `x-forwarded-client-cert-subject-dn` (base64 encoded)
     - `x-forwarded-client-cert-root-ca-dn` (base64 encoded)
   - Issuer and subject are validated as a pair
   - Root CA DN is validated separately
   - All three must match for authentication to succeed

## Distinguished Name (DN) Matching

DN matching is order-independent. These are considered identical:

```
"CN=Test,O=ACME,C=DE"
"C=DE,O=ACME,CN=Test"
```

Both comma-separated and slash-separated formats are supported:

```
"CN=Test,O=ACME,C=DE"
"/C=DE/O=ACME/CN=Test"
```

## Error Handling

- **Endpoint Fetch Failure**: If all endpoints fail and no static configuration exists, service startup will fail
- **Partial Endpoint Failure**: If some endpoints fail but others succeed (or static config exists), service continues
- **Invalid Response Format**: Endpoints returning invalid JSON are logged and skipped
- **Timeout**: Endpoints that don't respond within 10 seconds are skipped
- **Runtime Auth Failure**: Invalid certificates receive 401/403 responses with appropriate error messages

## Security Considerations

1. **Root CA Trust**: Root CA DNs are NEVER fetched from endpoints, only from static configuration
2. **Pair Matching**: Issuer and subject must match as a pair - mixing is not allowed
3. **TLS Termination**: This assumes TLS termination happens at the CF router level
4. **No Cryptographic Validation**: This module validates DN strings only, not actual certificates

## Logging

The implementation provides detailed logging:

```
INFO: Fetching mTLS trusted certificates from 2 endpoint(s)...
INFO: Successfully fetched mTLS cert info from https://config1.example.com/mtls-info
ERROR: Failed to fetch mTLS cert from https://config2.example.com/mtls-info: Network error
INFO: Merged mTLS config: 3 certificate pair(s), 2 root CA DN(s)
INFO: Loaded 3 trusted certificate pair(s) and 2 trusted root CA DN(s)
```

## Testing

Run the test suite:

```bash
# Test CF mTLS module
npm test -- __tests__/unittest/cf-mtls.test.js

# Test endpoint service
npm test -- __tests__/unittest/mtls-endpoint-service.test.js
```

## Migration from Old Configuration

If you're using the old configuration format with separate environment variables:

**Old format** (deprecated):
```bash
CF_MTLS_TRUSTED_CERT_PAIRS='[{"issuer":"...","subject":"..."}]'
CF_MTLS_TRUSTED_ROOT_CA_DNS='["..."]'
```

**New format**:
```bash
CF_MTLS_TRUSTED_CERTS='{"certs":[{"issuer":"...","subject":"..."}],"rootCaDn":["..."]}'
```

## Related Documentation

- [Provider Server PR #183](https://github.com/open-resource-discovery/provider-server/pull/183) - Reference implementation
