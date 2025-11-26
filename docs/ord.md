# CAP-JS ORD Plugin Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Configuration](#configuration)
   - [Global Application Settings](#1-overriding-global-application-information)
   - [Service-Level Customization](#2-overriding-service-level-information)
3. [Custom ORD Content](#adding-custom-ord-content)
4. [Products](#adding-products)
   - [Using Existing SAP Products](#1-using-an-existing-sap-product)
   - [Defining Custom Products](#2-defining-a-non-sap-product)
5. [Authentication](#authentication)
   - [CF mTLS Authentication](#cf-mtls-authentication)
6. [Parameters](#parameters)
7. [ORD Root Properties](#ord-root-property)

---

## Introduction

The CAP-JS ORD plugin automatically generates Open Resource Discovery (ORD) documents for your CAP applications. This documentation covers how to customize and configure the plugin to meet your specific needs.

---

## Configuration

### 1. Overriding Global Application Information

Global settings can be defined using the `present configuration` in your `.cdsrc.json` or `package.json` file under the `ord` section.

**Example:**

```json
{
    "ord": {
        "namespace": "sap.sample",
        "description": "This is my custom description",
        "policyLevels": ["sap:core:v1"]
    }
}
```

---

### 2. Overriding Service-Level Information

Service-specific data can be added or overwritten using annotations in your `.cds` files with `@ORD.Extensions`.

**Example:**

```js
annotate ProcessorService with @ORD.Extensions: {
    title: 'This is Processor Service title',
    industry: [
        'Retail',
        'Consumer Products'
    ],
    lineOfBusiness: ['Sales'],
    extensible: { supported: 'no' }
};
```

> **Note:**
> Standard annotations like `@Core.Description` and `@description` are also automatically read by the plugin.

---

## Adding Custom ORD Content

The ORD plugin allows adding **custom ORD content** via the `customOrdContentFile` setting in `.cdsrc.json`.

The override priority is as follows:

```
customOrdContent > ORD.Extensions Annotations > CAP Annotations > Plugin Defaults
```

**Example configuration:**

```json
{
    "ord": {
        "namespace": "sap.sample",
        "description": "This is my custom description",
        "policyLevels": ["sap:core:v1"],
        "customOrdContentFile": "./path/to/custom.ord.json"
    }
}
```

### Custom ORD File Structure

In your custom ORD file, you can:

- Add new ORD resources (e.g., `dataProducts`) not supported by CAP.
- Enhance existing generated resources (e.g., add a new `package` or an API resource).
- Patch default generated resources:
    - Override properties.
    - Add new properties.
    - Delete properties by setting them to `null`.

**Example `custom.ord.json`:**

```json
{
    "packages": [
        {
            "description": null,
            "packageLinks": [
                {
                    "type": "terms-of-service",
                    "url": "https://www.sap.com/corporate/en/legal/terms-of-use.html"
                }
            ],
            "lineOfBusiness": ["Sales"]
        }
    ],
    "dataProducts": [
        {
            "ordId": "sap.sm:dataProduct:Supplier:v1"
            // ...
        }
    ]
}
```

---

## Adding Products

You can define product relationships within the ORD document following these rules:

### 1. Using an Existing SAP Product

To associate your resources with an existing SAP product, define `existingProductORDId` in `.cdsrc.json`.

**Example:**

```json
{
    "ord": {
        "namespace": "sap.sample",
        "description": "This is my custom description",
        "policyLevels": ["sap:core:v1"],
        "customOrdContentFile": "./ord/custom.ord.json",
        "existingProductORDId": "sap:product:SAPServiceCloudV2:"
    }
}
```

> In this case, the ORD document will **not** contain a `products` root property. Instead, `packages` will be assigned to the specified product via `partOfProducts`.

**Example package entry:**

```json
{
    "ordId": "sap.sample:package:capireordsample-api:v1",
    "title": "Capire ORD Sample",
    "shortDescription": "Package containing public APIs",
    "description": "This package contains public APIs for Capire ORD Sample.",
    "version": "1.0.0",
    "partOfProducts": ["sap:product:SAPServiceCloudV2:"],
    "vendor": "sap:vendor:SAP:"
}
```

---

### 2. Defining a Non-SAP Product

If defining a **custom product**, make sure its `ordId` **does not** start with `sap`. (The plugin validates this.)

**Example:**

```json
{
    "ord": {
        "namespace": "sap.sample",
        "description": "This is my custom description",
        "policyLevels": ["sap:core:v1"],
        "customOrdContentFile": "./ord/custom.ord.json",
        "products": [
            {
                "ordId": "customer:product:eb.bm.tests:",
                "vendor": "sap:vendor:SAP:"
            }
        ]
    }
}
```

If the product `ordId` is invalid, the plugin will fall back to using a default value.

---

### 3. No Product Settings

If no explicit product settings are provided, the plugin will automatically apply its default behavior.

---

## Authentication

The ORD plugin supports multiple authentication mechanisms to protect ORD endpoints and metadata.

### CF mTLS Authentication

CF (Cloud Foundry) mTLS authentication provides secure machine-to-machine communication in SAP BTP Cloud Foundry environments using client certificate validation with enhanced security checks.

#### Overview

CF mTLS authentication uses mutual TLS (mTLS) with comprehensive certificate validation:

1. **TLS Termination & Certificate Validation**: Handled by the CloudFoundry gorouter
   - Verifies the certificate chain
   - Validates the certificate issuer
   - Ensures the certificate is not expired or revoked
   - Forwards certificate information via base64-encoded HTTP headers

2. **Certificate Information Validation**: Handled by this ORD plugin
   - Validates Issuer DN (Distinguished Name)
   - Validates Subject DN
   - Validates Root CA DN
   - Requires Issuer + Subject to match as a pair
   - Returns HTTP 401 (Unauthorized) for missing certificates
   - Returns HTTP 403 (Forbidden) for invalid certificate information
   - Returns HTTP 400 (Bad Request) for malformed headers

**Important**: This implementation is designed for SAP BTP Cloud Foundry environments where the gorouter terminates TLS and forwards certificate information via three separate base64-encoded headers.

---

#### Static Configuration

Configure CF mTLS with certificates defined directly in your configuration files or environment variables.

##### Via .cdsrc.json

```json
{
    "authentication": {
        "types": ["cf-mtls"]
    },
    "ord": {
        "cfMtls": {
            "certs": [
                {
                    "issuer": "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                    "subject": "CN=ord-aggregator, O=SAP SE, C=DE"
                },
                {
                    "issuer": "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                    "subject": "CN=backup-aggregator, O=SAP SE, C=US"
                }
            ],
            "rootCaDn": [
                "CN=SAP Global Root CA, O=SAP SE, C=DE",
                "CN=DigiCert Global Root CA, O=DigiCert Inc, C=US"
            ]
        }
    }
}
```

##### Via Environment Variables

```bash
# Set authentication type to CF mTLS
export ORD_AUTH_TYPE='["cf-mtls"]'

# Configure trusted certificates (JSON format)
export CF_MTLS_TRUSTED_CERTS='{
  "certs": [
    {
      "issuer": "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
      "subject": "CN=ord-aggregator, O=SAP SE, C=DE"
    }
  ],
  "rootCaDn": [
    "CN=SAP Global Root CA, O=SAP SE, C=DE"
  ]
}'
```

---

#### Dynamic Configuration

CF mTLS supports fetching trusted certificates dynamically from external configuration endpoints. This allows for centralized certificate management without redeploying your application.

##### Configuration with Endpoints

Both static certificates and dynamic endpoints can be combined. Certificates from endpoints will be merged with static configuration.

**Via .cdsrc.json:**

```json
{
    "authentication": {
        "types": ["cf-mtls"]
    },
    "ord": {
        "cfMtls": {
            "certs": [
                {
                    "issuer": "CN=Static CA, O=MyOrg, C=DE",
                    "subject": "CN=static-app, O=MyOrg, C=DE"
                }
            ],
            "rootCaDn": ["CN=MyOrg Root CA, C=DE"],
            "configEndpoints": [
                "https://config.example.com/mtls-info"
            ]
        }
    }
}
```

**Via Environment Variable:**

```bash
export CF_MTLS_TRUSTED_CERTS='{
  "certs": [{"issuer":"CN=CA,O=Org,C=DE","subject":"CN=service,O=Org,C=DE"}],
  "rootCaDn": ["CN=Root CA,O=Org,C=DE"],
  "configEndpoints": ["https://config.example.com/mtls-info"]
}'
```

##### Endpoint Response Format

Each endpoint should return JSON in this format:

```json
{
  "certIssuer": "CN=Dynamic CA, O=Org, C=DE",
  "certSubject": "CN=dynamic-service, O=Org, C=DE"
}
```

##### Dynamic Configuration Features

- **Multiple endpoints supported**: Fetched in parallel for performance
- **Automatic retry and error handling**: Failed endpoints don't block authentication if static config exists
- **Certificate merging**: Certificates from endpoints are merged with static configuration
- **Duplicate removal**: Automatically removes duplicate certificates
- **Timeout protection**: 10-second timeout per endpoint (default)
- **Security by design**: Root CA DNs are ONLY read from static configuration, never from endpoints

##### How It Works

1. **Service Startup**: 
   - Authentication configuration is initialized
   - If `configEndpoints` are configured, certificates are fetched from all endpoints in parallel
   - Fetched certificates are merged with static configuration
   - Duplicate certificates are removed

2. **Request Authentication**:
   - Client certificate information is extracted from HTTP headers
   - Issuer and subject are validated as a pair
   - Root CA DN is validated separately
   - All three must match for authentication to succeed

##### Configuration Examples

**Static Configuration Only:**

```json
{
    "ord": {
        "cfMtls": {
            "certs": [
                {
                    "issuer": "CN=Static CA, O=MyOrg, C=DE",
                    "subject": "CN=my-app, O=MyOrg, C=DE"
                }
            ],
            "rootCaDn": ["CN=MyOrg Root CA, C=DE"]
        }
    }
}
```

**Dynamic Configuration Only:**

```json
{
    "ord": {
        "cfMtls": {
            "certs": [],
            "rootCaDn": ["CN=MyOrg Root CA, C=DE"],
            "configEndpoints": [
                "https://config.myorg.com/mtls-certs"
            ]
        }
    }
}
```

**Combined Static + Dynamic:**

```json
{
    "ord": {
        "cfMtls": {
            "certs": [
                {
                    "issuer": "CN=Static CA, O=MyOrg, C=DE",
                    "subject": "CN=static-app, O=MyOrg, C=DE"
                }
            ],
            "rootCaDn": ["CN=MyOrg Root CA, C=DE"],
            "configEndpoints": [
                "https://config-primary.myorg.com/mtls-certs",
                "https://config-backup.myorg.com/mtls-certs"
            ]
        }
    }
}
```

---

#### Configuration Parameters

| Parameter | Environment Variable | cds.env Path | Default | Description |
|-----------|---------------------|--------------|---------|-------------|
| Authentication Type | `ORD_AUTH_TYPE` | `authentication.types` | - | Must include `"cf-mtls"` |
| Trusted Certs | `CF_MTLS_TRUSTED_CERTS` | `ord.cfMtls.certs` | `[]` | Optional (if `configEndpoints` provided). Array of issuer/subject pairs |
| Trusted Root CAs | `CF_MTLS_TRUSTED_CERTS` | `ord.cfMtls.rootCaDn` | - | **Required**. Array of trusted root CA DNs |
| Config Endpoints | `CF_MTLS_TRUSTED_CERTS` | `ord.cfMtls.configEndpoints` | `[]` | Optional. URLs to fetch certificates dynamically |

**Note**: The new unified format uses a single `CF_MTLS_TRUSTED_CERTS` environment variable containing all configuration fields (`certs`, `rootCaDn`, `configEndpoints`).

---

#### Certificate Validation Rules

The plugin validates certificates according to the CF mTLS specification (`sap:cmp-mtls:v1`):

1. **Pair Validation**: Issuer and Subject must match together as a configured pair
   - You cannot have valid issuer with wrong subject or vice versa
   - Both must match one of the configured pairs

2. **Root CA Validation**: Root CA DN must match one of the trusted root CAs
   - Provides additional security layer
   - Ensures certificate is from a trusted authority chain

3. **Order-Insensitive DN Comparison**: Token order in Distinguished Names doesn't matter
   - `"CN=test, O=SAP SE, C=DE"` matches `"C=DE, O=SAP SE, CN=test"`

4. **Whitespace Normalization**: Extra spaces are trimmed from each token
   - `"CN=test, O=SAP SE, C=DE"` matches `"CN=test,O=SAP SE,C=DE"`

5. **Exact Token Match**: All tokens must match exactly (set equality)
   - `"CN=test, O=SAP SE"` does NOT match `"CN=test, O=SAP SE, C=DE"`

---

#### Certificate Headers

The CloudFoundry gorouter forwards certificate information via three separate base64-encoded headers:

| Header | Content | Encoding |
|--------|---------|----------|
| `x-forwarded-client-cert-issuer-dn` | Certificate Issuer DN | Base64 |
| `x-forwarded-client-cert-subject-dn` | Certificate Subject DN | Base64 |
| `x-forwarded-client-cert-root-ca-dn` | Root CA DN | Base64 |

**Example header values:**

```
x-forwarded-client-cert-issuer-dn: Q049U0FQIENsb3VkIFBsYXRmb3JtIENsaWVudCBDQSwgTz1TQVAgU0UsIEM9REU=
x-forwarded-client-cert-subject-dn: Q049YWdncmVnYXRvciwgTz1TQVAgU0UsIEM9REU=
x-forwarded-client-cert-root-ca-dn: Q049U0FQIEdsb2JhbCBSb290IENBLCBPPU5BUCBTRSwgQz1ERQ==
```

These decode to:
```
Issuer:  CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE
Subject: CN=aggregator, O=SAP SE, C=DE
Root CA: CN=SAP Global Root CA, O=SAP SE, C=DE
```

---

#### Combining with Other Authentication Methods

CF mTLS can be combined with Basic authentication to support multiple client types:

```json
{
    "authentication": {
        "types": ["basic", "cf-mtls"],
        "credentials": {
            "admin": "$2a$10$..."
        }
    },
    "ord": {
        "cfMtls": {
            "certs": [
                {
                    "issuer": "CN=SAP Cloud Platform Client CA, O=SAP SE, C=DE",
                    "subject": "CN=ord-aggregator, O=SAP SE, C=DE"
                }
            ],
            "rootCaDn": [
                "CN=SAP Global Root CA, O=SAP SE, C=DE"
            ]
        }
    }
}
```

**Note**: You cannot combine `"open"` authentication with any other type.

---

#### HTTP Status Codes

| Status Code | Reason | Description |
|-------------|--------|-------------|
| 200 OK | Valid certificate | Certificate pair and root CA match configuration |
| 400 Bad Request | Invalid encoding | Certificate headers are not properly base64-encoded |
| 401 Unauthorized | Missing headers | One or more required certificate headers are missing |
| 403 Forbidden | Certificate pair mismatch | Issuer/Subject pair doesn't match any configured pair |
| 403 Forbidden | Root CA mismatch | Root CA DN doesn't match any trusted root CA |

---

#### Error Handling

**Endpoint-Related Errors:**

- **Endpoint Fetch Failure**: If all endpoints fail and no static configuration exists, service startup will fail
- **Partial Endpoint Failure**: If some endpoints fail but others succeed (or static config exists), service continues
- **Invalid Response Format**: Endpoints returning invalid JSON are logged and skipped
- **Timeout**: Endpoints that don't respond within 10 seconds are skipped

**Runtime Auth Errors:**

- Invalid certificates receive 401/403 responses with appropriate error messages
- Failed authentication attempts are logged with certificate details for security auditing

---

#### Security Considerations

1. **Header Trust**: This implementation trusts the certificate information forwarded in HTTP headers. SAP BTP Cloud Foundry gorouter ensures these headers are secure and cannot be spoofed.

2. **TLS at the Edge**: The CloudFoundry gorouter terminates TLS and performs full certificate validation before forwarding requests to your application.

3. **Certificate Pair Whitelist**: Keep your certificate pairs list minimal and up-to-date. Remove pairs for decommissioned clients.

4. **Root CA Validation**: Always configure trusted root CAs to ensure certificates come from authorized certificate authorities.

5. **Root CA Trust**: Root CA DNs are NEVER fetched from endpoints, only from static configuration. This is a security-by-design decision.

6. **No Cryptographic Validation**: This module validates DN strings only, not actual certificates. Cryptographic validation is handled by the CF router.

7. **Logging**: Failed authentication attempts are logged with certificate details for security auditing.

---

#### Troubleshooting

##### "CF mTLS requires at least one certificate pair"

**Cause**: After merging static configuration and endpoint responses, no certificate pairs were available. This can happen when:
- The `certs` array is empty or omitted
- All `configEndpoints` failed to load certificates
- No endpoints were configured and no static `certs` were provided

**Solution**: 
- Configure at least one certificate pair via `cds.env.ord.cfMtls.certs` or the `CF_MTLS_TRUSTED_CERTS` environment variable, OR
- Ensure at least one `configEndpoint` is reachable and returns valid certificate information, OR
- Use a combination of both static and dynamic configuration

##### "CF mTLS requires at least one root CA DN"

**Cause**: The `rootCaDn` array is missing or empty.

**Solution**: Configure at least one trusted root CA via `cds.env.ord.cfMtls.rootCaDn` or the `CF_MTLS_TRUSTED_CERTS` environment variable.

##### "Client certificate authentication required" (401)

**Cause**: One or more certificate headers are missing from the request.

**Solution**: 
- Verify the client is sending a valid certificate
- Check that the CloudFoundry gorouter is forwarding certificate information
- Verify the header names match your configuration

##### "Bad Request: Invalid certificate headers" (400)

**Cause**: Certificate headers are not properly base64-encoded.

**Solution**:
- Ensure headers are base64-encoded
- Verify the CloudFoundry gorouter is configured correctly
- Check for header corruption during transmission

##### "Forbidden: Invalid client certificate" (403)

**Cause**: The certificate issuer/subject pair doesn't match any configured pair.

**Solution**:
- Check the application logs for the actual Issuer and Subject received
- Verify both issuer and subject are configured as a pair
- Remember that all DN tokens must match (not just CN)

##### "Forbidden: Untrusted certificate authority" (403)

**Cause**: The root CA DN doesn't match any trusted root CA.

**Solution**:
- Check the application logs for the actual Root CA DN received
- Add the root CA to your trusted list if legitimate
- Verify the certificate chain is correct

##### Endpoint Fetch Issues

**Symptom**: Logs show "Failed to fetch mTLS cert from [endpoint]"

**Solutions**:
- Verify endpoint URL is correct and accessible
- Check network connectivity from your application
- Ensure endpoint returns valid JSON in the expected format
- Check for timeout issues (default 10 seconds)
- Review endpoint logs for errors

---

#### Logging

The implementation provides detailed logging for monitoring and debugging:

```
INFO: Fetching mTLS trusted certificates from 2 endpoint(s)...
INFO: Successfully fetched mTLS cert info from https://config1.example.com/mtls-info
ERROR: Failed to fetch mTLS cert from https://config2.example.com/mtls-info: Network error
INFO: Merged mTLS config: 3 certificate pair(s), 2 root CA DN(s)
INFO: Loaded 3 trusted certificate pair(s) and 2 trusted root CA DN(s)
```

---

#### ORD Access Strategy

When CF mTLS is configured, the plugin automatically adds `"sap:cmp-mtls:v1"` to the `accessStrategies` in the generated ORD document, indicating that resources are protected by CF mTLS authentication.

---

## Parameters

### `defaultVisibility`

The `defaultVisibility` property sets the default visibility for resources generated in the ORD document.
Possible values include `"public"`, `"internal"`, or `"private"`.
If not specified, the plugin uses its built-in default.

**Example:**

```json
{
    "ord": {
        "namespace": "sap.sample",
        "description": "This is my custom description",
        "policyLevels": ["sap:core:v1"],
        "defaultVisibility": "public"
    }
}
```

> **Note:** You can override visibility for individual resources using service-level annotations or custom ORD content.

---

## ORD Root Property

More information, see [ORD Document specification](https://pages.github.tools.sap/CentralEngineering/open-resource-discovery-specification/spec-v1/interfaces/document)

---

## Summary

| Scenario                         | Approach                                          |
| -------------------------------- | ------------------------------------------------- |
| Global Metadata                  | Define in `.cdsrc.json` under `ord`                |
| Service Metadata                 | Use `@ORD.Extensions` annotations in `.cds` files |
| Custom ORD Content               | Use `customOrdContentFile`                        |
| Linking to Existing SAP Products | Use `existingProductORDId`                        |
| Defining Custom Products         | Add `products` section manually                   |
| Basic Authentication             | Configure in `authentication.types`               |
| CF mTLS Static Config            | Define `certs` and `rootCaDn` in `ord.cfMtls`     |
